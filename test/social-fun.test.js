// Nouveautés sociales (v2.18.0) : stickers, série du groupe, endurance, ligue.
//
// La série du groupe désigne publiquement « qui manque à l'appel » : se
// tromper, c'est accuser une copine à tort devant tout le groupe.

const test = require('node:test');
const assert = require('node:assert');
const { loadInto } = require('./helpers/load');

const F = loadInto('js/social-fun.js').SocialFun;

const at = (y, m, d, h = 12) => new Date(y, m, d, h).getTime();
const jour = (y, m, d) => new Date(y, m, d).toDateString();

// ---------- Stickers ----------

test('un sticker fait l\'aller-retour texte -> sticker', () => {
  F.STICKERS.forEach(st => {
    const body = F.stickerBody(st.id);
    assert.ok(body, st.id);
    assert.strictEqual(F.parseSticker(body).id, st.id);
    assert.ok(body.length <= 280, 'tient dans un commentaire');
  });
});

test('parseSticker : du texte ordinaire ou un id inconnu restent du texte', () => {
  assert.strictEqual(F.parseSticker('Bravo ma belle'), null);
  assert.strictEqual(F.parseSticker(':sticker:inexistant:'), null);
  assert.strictEqual(F.parseSticker('trop fort :sticker:bravo:'), null, 'le sticker doit être seul');
  assert.strictEqual(F.parseSticker(null), null);
  assert.strictEqual(F.stickerBody('inexistant'), null);
});

test('stickerUnlocked : libres par défaut, ceux des jeux exigent leur badge', () => {
  const libre = F.STICKERS.find(s => !s.unlock);
  const jeu = F.STICKERS.find(s => s.unlock === 'sniper');
  assert.strictEqual(F.stickerUnlocked(libre, []), true);
  assert.strictEqual(F.stickerUnlocked(jeu, []), false);
  assert.strictEqual(F.stickerUnlocked(jeu, ['sniper']), true);
  assert.strictEqual(F.stickerUnlocked(null, ['sniper']), false);
  // Verrouillé ou non, il reste lisible dans un commentaire
  assert.strictEqual(F.parseSticker(F.stickerBody(jeu.id)).id, jeu.id);
});

test('les ids de stickers sont uniques', () => {
  const ids = F.STICKERS.map(s => s.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

// ---------- Série du groupe ----------

const now = at(2026, 8, 17, 18);
const membre = (id, jours) => ({ id, username: id, avatar: '💩', days: jours.map(([y, m, d]) => jour(y, m, d)) });

test('groupStreak : jours où toutes les membres actives ont posté', () => {
  const g = F.groupStreak([
    membre('a', [[2026, 8, 17], [2026, 8, 16], [2026, 8, 15], [2026, 8, 14]]),
    membre('b', [[2026, 8, 17], [2026, 8, 16], [2026, 8, 15]]),
  ], now);
  assert.strictEqual(g.days, 3);
  assert.strictEqual(g.includesToday, true);
  assert.strictEqual(g.missingToday.length, 0);
});

test('groupStreak : pas encore complet aujourd\'hui -> série d\'hier et liste des absentes', () => {
  const g = F.groupStreak([
    membre('a', [[2026, 8, 17], [2026, 8, 16], [2026, 8, 15]]),
    membre('b', [[2026, 8, 16], [2026, 8, 15]]),
  ], now);
  assert.strictEqual(g.days, 2);
  assert.strictEqual(g.includesToday, false);
  assert.strictEqual(g.missingToday.length, 1);
  assert.strictEqual(g.missingToday[0].id, 'b');
});

test('groupStreak : une copine inactive depuis plus de 30 jours ne bloque pas le groupe', () => {
  const g = F.groupStreak([
    membre('a', [[2026, 8, 17], [2026, 8, 16]]),
    membre('b', [[2026, 8, 17], [2026, 8, 16]]),
    membre('partie', [[2026, 5, 1]]),
  ], now);
  assert.strictEqual(g.days, 2);
  assert.strictEqual(g.activeMembers, 2);
  assert.ok(!g.missingToday.some(m => m.id === 'partie'));
});

test('groupStreak : seule active, pas de série de groupe', () => {
  assert.strictEqual(F.groupStreak([membre('a', [[2026, 8, 17]]), membre('b', [])], now), null);
  assert.strictEqual(F.groupStreak([], now), null);
});

// ---------- Endurance ----------

test('enduranceRanking : classée par plus longue séance, sans les non chronométrées', () => {
  const r = F.enduranceRanking([
    { id: 'a', username: 'a', durations: [300, 120] },
    { id: 'b', username: 'b', durations: [900] },
    { id: 'c', username: 'c', durations: [] },
  ]);
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r[0].id, 'b');
  assert.strictEqual(r[1].avg, 210);
  assert.strictEqual(r[1].count, 2);
});

// ---------- Ligue ----------

test('leagueWeekStart : lundi minuit, y compris le dimanche', () => {
  const jeudi = new Date(F.leagueWeekStart(at(2026, 8, 17)));
  assert.strictEqual(jeudi.getDay(), 1);
  assert.strictEqual(jeudi.getDate(), 14);
  assert.strictEqual(jeudi.getHours(), 0);
  assert.strictEqual(new Date(F.leagueWeekStart(at(2026, 8, 20, 23))).getDate(), 14);
  assert.strictEqual(new Date(F.leagueWeekStart(at(2026, 8, 21, 0))).getDate(), 21);
});

// ---------- Titres hebdo ----------

test('weeklyMemberTitle : null si moins de 2 cacas sur les 7 derniers jours', () => {
  const ref = at(2026, 8, 17, 18);
  assert.strictEqual(F.weeklyMemberTitle([], ref), null);
  assert.strictEqual(F.weeklyMemberTitle([{ date: at(2026, 8, 17, 10) }], ref), null);
  // Entrées vieilles de plus de 7 jours ignorées
  assert.strictEqual(F.weeklyMemberTitle([
    { date: at(2026, 8, 1, 10) },
    { date: at(2026, 8, 2, 10) },
    { date: at(2026, 8, 17, 10) },
  ], ref), null);
});

test('weeklyMemberTitle : attribue le titre selon le profil de la semaine', () => {
  const ref = at(2026, 8, 17, 18);

  const matinal = F.weeklyMemberTitle([
    { date: at(2026, 8, 16, 7) },
    { date: at(2026, 8, 17, 8) },
  ], ref);
  assert.strictEqual(matinal.id, 'matinal');
  assert.strictEqual(matinal.emoji, '☀️');

  const hibou = F.weeklyMemberTitle([
    { date: at(2026, 8, 16, 23) },
    { date: at(2026, 8, 17, 14) },
  ], ref);
  assert.strictEqual(hibou.id, 'hibou');
  assert.strictEqual(hibou.emoji, '🦉');

  const voyageur = F.weeklyMemberTitle([
    { date: at(2026, 8, 15, 12), place: 'Maison' },
    { date: at(2026, 8, 16, 12), place: 'Boulot' },
    { date: at(2026, 8, 17, 12), city: 'Lyon' },
  ], ref);
  assert.strictEqual(voyageur.id, 'voyageur');
  assert.strictEqual(voyageur.emoji, '🗺️');

  const express = F.weeklyMemberTitle([
    { date: at(2026, 8, 16, 12), duration: 60 },
    { date: at(2026, 8, 17, 12), duration_s: 80 },
  ], ref);
  assert.strictEqual(express.id, 'express');
  assert.strictEqual(express.emoji, '⚡');

  const prolifique = F.weeklyMemberTitle(
    Array.from({ length: 10 }, (_, i) => ({ date: at(2026, 8, 11 + Math.floor(i / 2), 14 + (i % 2)) })),
    ref
  );
  assert.strictEqual(prolifique.id, 'prolifique');

  const regulier = F.weeklyMemberTitle([
    { date: at(2026, 8, 16, 14), duration: 240 },
    { date: at(2026, 8, 17, 15), duration: 300 },
  ], ref);
  assert.strictEqual(regulier.id, 'regulier');
});

// ---------- Télépathie intestinale ----------

test('detectTelepathy : détecte les paires distinctes à <= maxGapMs et dédoublonne', () => {
  assert.strictEqual(F.detectTelepathy(null).length, 0);
  const t0 = at(2026, 8, 17, 10);
  const items = [
    { user_id: 'a', username: 'Léa', avatar: '🦊', date: t0 },
    { user_id: 'a', username: 'Léa', avatar: '🦊', date: t0 + 60_000 }, // même utilisatrice
    { user_id: 'b', username: 'Zoé', avatar: '🐱', date: t0 + 120_000 }, // 1 min après Léa #2, 2 min après Léa #1 -> dédoublonné
    { user_id: 'c', username: 'Mia', avatar: '🐼', date: t0 + 10 * 60_000 }, // > 5 min
  ];
  const matches = F.detectTelepathy(items);
  assert.strictEqual(matches.length, 1);
  assert.strictEqual(matches[0].users[0].user_id, 'a');
  assert.strictEqual(matches[0].users[1].user_id, 'b');
  assert.ok(matches[0].gapMs <= 5 * 60 * 1000);
});

// ---------- Mission coopérative du week-end ----------

test('weekendCoopMission : détecte le week-end et calcule la progression', () => {
  // 2026-09-19 est un samedi (mois 8 en base 0), 2026-09-17 un jeudi
  const samedi = at(2026, 8, 19, 15);
  const jeudi = at(2026, 8, 17, 15);

  const enSemaine = F.weekendCoopMission([], 2, jeudi);
  assert.strictEqual(enSemaine.isWeekend, false);
  assert.strictEqual(enSemaine.target, 8);
  assert.strictEqual(enSemaine.count, 0);
  assert.strictEqual(enSemaine.done, false);

  const logs = [
    [
      { date: at(2026, 8, 18, 23) }, // vendredi : hors week-end
      { date: at(2026, 8, 19, 9) },
      { date: at(2026, 8, 19, 18) },
    ],
    [
      { date: at(2026, 8, 20, 10) },
      { date: at(2026, 8, 20, 21) },
    ],
  ];
  const m = F.weekendCoopMission(logs, 1, samedi);
  assert.strictEqual(m.isWeekend, true);
  assert.strictEqual(m.count, 4);
  assert.strictEqual(m.target, 4);
  assert.strictEqual(m.pct, 100);
  assert.strictEqual(m.done, true);
});
