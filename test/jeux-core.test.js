// Jeux du trône : temps limité, statistiques, badges, classement.
//
// Le temps limité est là pour la santé : s'il ne coupe jamais, le jeu pousse
// à rester assise plus longtemps, l'inverse du but. Et le classement est
// affiché à tout le groupe : un score attribué à la mauvaise copine se voit.

const test = require('node:test');
const assert = require('node:assert');
const { loadInto } = require('./helpers/load');

const J = loadInto('js/jeux/jeux-core.js').JeuxCore;

const MIN = 60 * 1000;
const t0 = new Date(2026, 8, 17, 8, 0, 0).getTime();

// ---------- Temps limité ----------

test('jeuxSession : pas de séance, pas de limite ni de pause', () => {
  const s = J.jeuxSession(t0, null, 0);
  assert.strictEqual(s.start, null);
  assert.strictEqual(s.remaining, J.JEUX_LIMITE_S);
  assert.strictEqual(s.over, false);
  assert.strictEqual(s.locked, false);
});

test('jeuxSession : alerte la dernière minute, fin à 8 minutes pile', () => {
  assert.strictEqual(J.jeuxSession(t0 + 6 * MIN, t0).warn, false);
  const alerte = J.jeuxSession(t0 + 7 * MIN + 30000, t0);
  assert.strictEqual(alerte.warn, true);
  assert.strictEqual(alerte.remaining, 30);
  assert.strictEqual(alerte.over, false);
  const fin = J.jeuxSession(t0 + 8 * MIN, t0);
  assert.strictEqual(fin.over, true);
  assert.strictEqual(fin.warn, false);
  assert.strictEqual(fin.remaining, 0);
});

test('jeuxSession : une séance oubliée depuis longtemps ne bloque plus', () => {
  // limite (8 min) + pause (10 min) dépassées : c'est une autre séance
  const s = J.jeuxSession(t0 + 19 * MIN, t0);
  assert.strictEqual(s.start, null);
  assert.strictEqual(s.over, false);
  // … mais juste après la limite, elle compte encore
  assert.strictEqual(J.jeuxSession(t0 + 12 * MIN, t0).over, true);
});

test('jeuxSession : la pause imposée verrouille, puis se lève', () => {
  const fin = t0 + 10 * MIN;
  const s = J.jeuxSession(t0 + 3 * MIN, null, fin);
  assert.strictEqual(s.locked, true);
  assert.strictEqual(s.lockRemaining, 7 * 60);
  assert.strictEqual(J.jeuxSession(fin, null, fin).locked, false);
});

test('formatMinSec', () => {
  assert.strictEqual(J.formatMinSec(0), '00:00');
  assert.strictEqual(J.formatMinSec(480), '08:00');
  assert.strictEqual(J.formatMinSec(61.9), '01:01');
  assert.strictEqual(J.formatMinSec(-5), '00:00');
});

// ---------- Statistiques ----------

test('recordGame : record, parties, et l\'objet d\'origine n\'est pas modifié', () => {
  const vide = J.defaultGameStats();
  const a = J.recordGame(vide, 'plop', { score: 12, perfectStreak: 4 }, t0);
  assert.strictEqual(vide.plays.plop, undefined, 'pas de mutation');
  assert.strictEqual(a.record, true);
  assert.strictEqual(a.previousBest, 0);
  assert.strictEqual(a.stats.best.plop, 12);
  assert.strictEqual(a.stats.records.perfectStreak, 4);

  const b = J.recordGame(a.stats, 'plop', { score: 8, perfectStreak: 2 }, t0);
  assert.strictEqual(b.record, false);
  assert.strictEqual(b.stats.best.plop, 12);
  assert.strictEqual(b.stats.plays.plop, 2);
  assert.strictEqual(b.stats.records.perfectStreak, 4, 'un exploit ne redescend pas');
});

test('recordGame : le meilleur score de la semaine repart à zéro le lundi', () => {
  const jeudi = new Date(2026, 8, 17, 12).getTime();
  const lundi = new Date(2026, 8, 21, 9).getTime();
  let r = J.recordGame(null, 'pq', { score: 30, height: 30 }, jeudi);
  assert.strictEqual(r.weekRecord, true);
  r = J.recordGame(r.stats, 'pq', { score: 20 }, jeudi);
  assert.strictEqual(r.weekRecord, false);
  assert.strictEqual(r.stats.week.scores.pq, 30);

  r = J.recordGame(r.stats, 'pq', { score: 5 }, lundi);
  assert.strictEqual(r.weekRecord, true, 'nouvelle semaine : 5 est le record de la semaine');
  assert.strictEqual(r.stats.week.scores.pq, 5);
  assert.strictEqual(r.stats.best.pq, 30, 'le record de tous les temps reste');
  assert.strictEqual(r.stats.week.start, J.jeuxWeekStart(lundi));
});

test('recordGame : la fosse ne part jamais au classement', () => {
  const r = J.recordGame(null, 'fosse', { score: 99 }, t0);
  assert.strictEqual(r.weekRecord, false);
  assert.strictEqual(J.unsyncedWeekScores(r.stats, t0).length, 0);
});

test('unsyncedWeekScores : seulement la semaine en cours et pas encore envoyés', () => {
  let r = J.recordGame(null, 'plop', { score: 10 }, t0);
  r = J.recordGame(r.stats, 'course', { score: 400 }, t0);
  const envoi = J.unsyncedWeekScores(r.stats, t0);
  assert.strictEqual(envoi.map(x => `${x.game}:${x.score}`).sort().join('|'), 'course:400|plop:10');
  assert.ok(envoi.every(x => x.week_start === J.jeuxWeekStart(t0)));

  r.stats.week.synced.plop = true;
  assert.strictEqual(J.unsyncedWeekScores(r.stats, t0).length, 1);
  // Semaine suivante : les vieux scores ne partent plus
  assert.strictEqual(J.unsyncedWeekScores(r.stats, t0 + 7 * 86400000).length, 0);
});

test('normalizeGameStats : JSON abîmé ou jeu inconnu ne cassent rien', () => {
  const s = J.normalizeGameStats({ best: { plop: 5, tetris: 9, pq: -3 }, records: { pqHeight: 'x' }, fosse: { owned: 'oops' } });
  assert.strictEqual(s.best.plop, 5);
  assert.strictEqual(s.best.tetris, undefined);
  assert.strictEqual(s.best.pq, 0);
  assert.strictEqual(s.records.pqHeight, 0);
  assert.strictEqual(s.fosse.owned.length, 0);
  assert.strictEqual(J.normalizeGameStats('pas un objet').sortiesDignes, 0);
});

test('jeuxWeekStart : lundi minuit, y compris le dimanche soir', () => {
  const d = new Date(J.jeuxWeekStart(new Date(2026, 8, 20, 23).getTime()));
  assert.strictEqual(d.getDay(), 1);
  assert.strictEqual(d.getDate(), 14);
  assert.strictEqual(d.getHours(), 0);
});

// ---------- Badges ----------

test('gameBadgeStates : paliers et progression', () => {
  const s = J.defaultGameStats();
  assert.strictEqual(J.gameBadgesDone(s).length, 0);
  s.records.perfectStreak = 10;
  s.records.pqHeight = 25;
  s.sortiesDignes = 20;
  s.fosse.owned = ['lombrics', 'semis', 'carottes', 'tournesols', 'tomates'];
  s.plays = { plop: 30, pq: 20 };
  const e = J.gameBadgeStates(s);
  assert.strictEqual(e.sniper.done, true);
  assert.strictEqual(e.architecte.done, false);
  assert.strictEqual(Math.round(e.architecte.pct), 50);
  assert.strictEqual(e.sortieDigne.done, true);
  assert.strictEqual(e.mainVerte.done, true);
  assert.strictEqual(e.gameuse.done, true);
  assert.strictEqual(J.gameBadgeStates(null).gameuse.done, false);
});

// ---------- Mascotte ----------

test('gameOverMascot : fête un record, s\'inquiète d\'un zéro', () => {
  assert.strictEqual(J.gameOverMascot(20, 10).mood, 'party');
  assert.strictEqual(J.gameOverMascot(0, 10).mood, 'worried');
  assert.ok(J.gameOverMascot(0, 10, { splash: true }).message.includes('éclabouss'));
  assert.strictEqual(J.gameOverMascot(5, 0, { plays: 1 }).mood, 'happy', 'première partie');
  assert.strictEqual(J.gameOverMascot(9, 10, { plays: 4 }).mood, 'happy', 'proche du record');
  assert.strictEqual(J.gameOverMascot(2, 10, { plays: 4 }).mood, 'waiting');
});

// ---------- Classement ----------

test('gameLeaderboard : bon jeu, bonnes copines, meilleur score d\'abord', () => {
  const members = [
    { id: 'a', username: 'Clem', avatar: '🦄' },
    { id: 'b', username: 'Lou' },
    { id: 'c', username: 'Zoé' },
  ];
  const rows = [
    { user_id: 'a', game: 'plop', score: 12 },
    { user_id: 'b', game: 'plop', score: 30 },
    { user_id: 'b', game: 'pq', score: 99 },
    { user_id: 'c', game: 'plop', score: 0 },
    { user_id: 'intruse', game: 'plop', score: 500 },
  ];
  const r = J.gameLeaderboard(rows, members, 'plop');
  assert.strictEqual(r.map(x => `${x.id}:${x.score}`).join('|'), 'b:30|a:12');
  assert.strictEqual(r[1].avatar, '🦄');
  assert.strictEqual(r[0].avatar, '💩', 'avatar par défaut');
  assert.strictEqual(J.gameLeaderboard(rows, members, 'colon').length, 0);
});

test('mulberry32 : même graine, même suite', () => {
  const a = J.mulberry32(42), b = J.mulberry32(42);
  for (let i = 0; i < 5; i++) assert.strictEqual(a(), b());
  const x = J.mulberry32(7)();
  assert.ok(x >= 0 && x < 1);
});

test('catalogue : ids uniques, tous les jeux classés ont une unité', () => {
  const ids = J.JEUX.map(j => j.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  J.JEUX.filter(j => j.classement).forEach(j => assert.ok(j.unite, j.id));
  assert.strictEqual(J.JEUX_CLASSES.join('|'), 'plop|pq|colon|course|quiz|transit');
});
