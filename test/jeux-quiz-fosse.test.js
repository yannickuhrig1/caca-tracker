// Jeux du trône : « Qui a fait ce caca ? » et Fosse septique tycoon.
//
// Le quiz montre les cacas des copines : il ne doit jamais proposer les
// siens, ni un indice tiré d'une donnée privée. La fosse, elle, est une
// petite économie : de l'engrais qui apparaît de nulle part ou une plante
// achetée à crédit, et le jeu n'a plus de sens.

const test = require('node:test');
const assert = require('node:assert');
const { loadInto } = require('./helpers/load');

const PoopMapModule = loadInto('js/poopmap.js').PoopMapModule;
const ctx = loadInto(['js/jeux/jeux-core.js', 'js/jeux/quiz.js', 'js/jeux/fosse.js'], { PoopMapModule });
const { JeuQuiz: Z, JeuFosse: F, JeuxCore: J } = ctx;

const now = new Date(2026, 8, 17, 18).getTime();
const jour = 86400000;
const members = [
  { id: 'moi', username: 'Clémence', avatar: '💖' },
  { id: 'a', username: 'Lou', avatar: '🦄' },
  { id: 'b', username: 'Zoé', avatar: '🐸' },
  { id: 'c', username: 'Inès', avatar: '🌸' },
];
const row = (user_id, joursAvant, o = {}) => ({ user_id, date: now - joursAvant * jour, texture: 'normal', color: 'marron', ...o });

// ---------- Quiz ----------

test('quizPool : jamais mes propres cacas, rien de plus vieux que 30 jours', () => {
  const { pool, candidats, jouable } = Z.quizPool([
    row('moi', 1), row('a', 2), row('a', 40), row('b', 5), row('inconnue', 1),
  ], members, 'moi', now);
  assert.strictEqual(pool.map(r => r.user_id).sort().join('|'), 'a|b');
  assert.strictEqual(candidats.map(c => c.id).join('|'), 'a|b');
  assert.strictEqual(jouable, true);
});

test('quizPool : une seule suspecte, pas jouable', () => {
  const { jouable } = Z.quizPool([row('a', 1), row('a', 2)], members, 'moi', now);
  assert.strictEqual(jouable, false);
});

test('quizQuestion : la bonne réponse est parmi les choix, sans doublon, 4 maximum', () => {
  const { pool, candidats } = Z.quizPool([row('a', 1), row('b', 2), row('c', 3)], members, 'moi', now);
  const rng = J.mulberry32(11);
  for (let i = 0; i < 50; i++) {
    const q = Z.quizQuestion(pool, candidats, rng);
    const ids = q.options.map(o => o.id);
    assert.ok(ids.includes(q.answer));
    assert.strictEqual(q.entry.user_id, q.answer);
    assert.strictEqual(new Set(ids).size, ids.length);
    assert.ok(ids.length <= Z.QUIZ.CHOIX_MAX && ids.length >= 2);
    assert.ok(!ids.includes('moi'));
  }
});

test('quizQuestion : la plus active ne rafle pas toutes les questions', () => {
  // 40 entrées pour Lou, 1 pour Zoé : chacune doit rester une réponse fréquente.
  const rows = [...Array.from({ length: 40 }, (_, i) => row('a', i * 0.5)), row('b', 1)];
  const { pool, candidats } = Z.quizPool(rows, members, 'moi', now);
  const rng = J.mulberry32(4);
  let zoe = 0;
  for (let i = 0; i < 400; i++) if (Z.quizQuestion(pool, candidats, rng).answer === 'b') zoe++;
  assert.ok(zoe > 150 && zoe < 250, `Zoé réponse ${zoe}/400`);
});

test('quizQuestion : évite de reposer les entrées récentes tant que possible', () => {
  const rows = [row('a', 1), row('a', 2), row('b', 3)];
  const { pool, candidats } = Z.quizPool(rows, members, 'moi', now);
  const recents = [`a:${rows[0].date}`];
  const rng = J.mulberry32(8);
  for (let i = 0; i < 40; i++) {
    const q = Z.quizQuestion(pool, candidats, rng, recents);
    if (q.answer === 'a') assert.strictEqual(q.entry.date, rows[1].date);
  }
});

test('quizClues : jour, heure, texture, couleur, lieu, durée ; ni note ni position', () => {
  const e = row('a', 0, { date: new Date(2026, 8, 15, 7, 5).getTime(), texture: 'dur', place: 'maison', duration_s: 190, comment: 'SECRET', lat: 48.1, lon: 7.3 });
  const indices = Z.quizClues(e);
  const txt = indices.map(c => c.text).join(' | ');
  assert.ok(txt.includes('mardi 15/09'), txt);
  assert.ok(txt.includes('07 h 05'), txt);
  assert.ok(txt.includes('Dur'));
  assert.ok(txt.includes('marron'));
  assert.ok(txt.includes('Maison'));
  assert.ok(txt.includes('3 min'));
  assert.ok(!txt.includes('SECRET') && !txt.includes('48.1'));
});

test('quizAnswer : bonne réponse, erreurs, temps écoulé et fin après 3 erreurs', () => {
  const { pool, candidats } = Z.quizPool([row('a', 1), row('b', 2)], members, 'moi', now);
  const s = Z.quizNew();
  const rng = J.mulberry32(2);
  Z.quizNext(s, pool, candidats, rng);
  assert.strictEqual(Z.quizAnswer(s, s.question.answer), true);
  assert.strictEqual(Z.quizAnswer(s, s.question.answer), false, 'pas deux réponses à la même question');
  assert.strictEqual(s.score, 1);

  Z.quizNext(s, pool, candidats, rng);
  Z.quizAnswer(s, s.question.answer);
  assert.strictEqual(s.bestStreak, 2);

  for (let i = 0; i < 3; i++) {
    Z.quizNext(s, pool, candidats, rng);
    Z.quizAnswer(s, null);
  }
  assert.strictEqual(s.over, true);
  assert.strictEqual(s.streak, 0);
  assert.strictEqual(s.score, 2);
  assert.strictEqual(Z.quizNext(s, pool, candidats, rng), null);
});

// ---------- Fosse ----------

const logs = (n, o = {}) => Array.from({ length: n }, (_, i) => ({ date: now - i * jour, texture: 'dur', color: 'marron', ...o }));

test('fosseGain : cacas, bonus normal, jours actifs et sorties dignes', () => {
  const g = F.FOSSE_GAIN;
  assert.strictEqual(F.fosseGain([], 0), 0);
  // 2 cacas le même jour, dont 1 normal
  const deux = [{ date: now, texture: 'normal' }, { date: now - 1000, texture: 'dur' }];
  assert.strictEqual(F.fosseGain(deux, 0), 2 * g.PAR_CACA + g.BONUS_NORMAL + g.PAR_JOUR);
  assert.strictEqual(F.fosseGain(deux, 3) - F.fosseGain(deux, 0), 3 * g.PAR_SORTIE_DIGNE);
});

test('fosseBuy : dans l\'ordre, et jamais à crédit', () => {
  let stats = J.defaultGameStats();
  const peu = logs(2);                      // 2 × (10 + 5 jour) = 30 < 50
  let r = F.fosseBuy(stats, peu, now);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'engrais');

  const assez = logs(10);                   // 10 × 15 = 150
  r = F.fosseBuy(stats, assez, now);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.item.id, 'lombrics');
  stats = r.stats;
  r = F.fosseBuy(stats, assez, now);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.item.id, 'semis');
  stats = r.stats;
  const st = F.fosseState(assez, stats, now);
  assert.strictEqual(st.solde, 150 - 50 - 100);
  assert.strictEqual(F.fosseBuy(stats, assez, now).ok, false);
});

test('fosseState : un achat hors ordre (stockage trafiqué) ne compte pas', () => {
  const stats = J.defaultGameStats();
  stats.fosse.owned = ['station', 'lombrics'];
  const st = F.fosseState(logs(10), stats, now);
  assert.strictEqual(st.owned.join('|'), 'lombrics');
  assert.strictEqual(st.next.id, 'semis');
});

test('fosseHarvest : une fois par jour, proportionnelle aux plantations', () => {
  let stats = J.defaultGameStats();
  const l = logs(30);
  assert.strictEqual(F.fosseHarvest(stats, l, now).ok, false, 'rien planté, rien à récolter');
  stats = F.fosseBuy(stats, l, now).stats;
  stats = F.fosseBuy(stats, l, now).stats;
  const avant = F.fosseState(l, stats, now).solde;
  const r = F.fosseHarvest(stats, l, now);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.gain, 2 * F.FOSSE_GAIN.RECOLTE_PAR_PLANTE);
  assert.strictEqual(F.fosseState(l, r.stats, now).solde, avant + r.gain);
  assert.strictEqual(F.fosseHarvest(r.stats, l, now + 3600000).ok, false, 'déjà récolté aujourd\'hui');
  const demain = new Date(now); demain.setDate(demain.getDate() + 1); demain.setHours(0, 5);
  assert.strictEqual(F.fosseHarvest(r.stats, l, demain.getTime()).ok, true);
});

test('fosse : le jardin complet coûte ce qu\'annoncé et se termine', () => {
  let stats = J.defaultGameStats();
  const total = F.FOSSE_ITEMS.reduce((a, i) => a + i.cout, 0);
  const l = logs(Math.ceil(total / 15) + 1);
  for (let i = 0; i < F.FOSSE_ITEMS.length; i++) {
    const r = F.fosseBuy(stats, l, now);
    assert.strictEqual(r.ok, true, F.FOSSE_ITEMS[i].id);
    stats = r.stats;
  }
  const st = F.fosseState(l, stats, now);
  assert.strictEqual(st.complet, true);
  assert.strictEqual(st.depense, total);
  assert.strictEqual(F.fosseBuy(stats, l, now).reason, 'complet');
  assert.strictEqual(J.gameBadgeStates(stats).mainVerte.done, true);
});
