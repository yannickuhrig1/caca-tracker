// Accueil, série en attente et Caca Wrapped (v2.18.0).
//
// La mascotte et la série s'affichent en permanence : une humeur fausse ou une
// série qui retombe à 0 à tort se voit tous les jours. Le Wrapped part en image
// sur les réseaux : ses chiffres doivent être justes.

const test = require('node:test');
const assert = require('node:assert');
const { loadInto, readGlobals, daysAgo } = require('./helpers/load');

const ctx = loadInto(['js/app/app-render.js', 'js/app/app-sante.js', 'js/app/app-accueil.js', 'js/app/app-wrapped.js'], {
  state: { logs: [] },
  $id: () => null, $debug: () => {}, esc: String, textureEmoji: () => '',
  renderDashboard: () => {}, renderHistory: () => {}, updateBadges: () => {}, updateChart: () => {},
});
const g = readGlobals(ctx, [
  'streakDetails', 'jokerToAnnounce', 'mascotLevel', 'mascotMood', 'mascotSVG', 'wrappedSeason',
  'periodRange', 'shareCardData', 'longestRun', 'weightComparison', 'buildYearWrapped',
]);

const at = (y, m, d, h = 12) => new Date(y, m, d, h).getTime();
const log = (date, o = {}) => ({ id: Math.random(), date, texture: 'normal', color: 'marron', ...o });

// ---------- Série en attente ----------

test('streakDetails : caca aujourd\'hui -> série en cours, rien en attente', () => {
  const r = g.streakDetails([0, 1, 2].map(n => log(daysAgo(n))));
  assert.strictEqual(r.current, 3);
  assert.strictEqual(r.pending, 0);
});

test('streakDetails : pas encore aujourd\'hui -> la série d\'hier est en attente', () => {
  const r = g.streakDetails([1, 2, 3, 4].map(n => log(daysAgo(n))));
  assert.strictEqual(r.current, 0, 'calculateStreak reste inchangé : 0');
  assert.strictEqual(r.pending, 4);
});

test('streakDetails : rien hier non plus -> ni série ni attente', () => {
  const r = g.streakDetails([2, 3].map(n => log(daysAgo(n))));
  assert.strictEqual(r.current, 0);
  assert.strictEqual(r.pending, 0);
});

test('streakDetails liste les jours pardonnés par le joker', () => {
  const r = g.streakDetails([0, 2, 3].map(n => log(daysAgo(n))));
  assert.strictEqual(r.current, 3);
  assert.strictEqual(r.jokers.length, 1);
  const hier = new Date(daysAgo(1)); hier.setHours(0, 0, 0, 0);
  assert.strictEqual(r.jokers[0], hier.getTime());
});

test('jokerToAnnounce : annoncé une seule fois, et seulement s\'il est récent', () => {
  const r = g.streakDetails([0, 2, 3].map(n => log(daysAgo(n))));
  const joker = g.jokerToAnnounce(r, null);
  assert.strictEqual(joker, r.jokers[0]);
  assert.strictEqual(g.jokerToAnnounce(r, String(joker)), null, 'déjà annoncé');
  const vieux = g.streakDetails([0, 1, 2, 3, 5, 6].map(n => log(daysAgo(n))));
  assert.strictEqual(g.jokerToAnnounce(vieux, null), null, 'joker d\'il y a 4 jours : trop tard pour le fêter');
  assert.strictEqual(g.jokerToAnnounce({ current: 0, jokers: [Date.now()] }, null), null, 'pas de série, pas d\'annonce');
});

// ---------- Mascotte ----------

test('mascotLevel : paliers et progression', () => {
  assert.strictEqual(g.mascotLevel(0).level, 1);
  assert.strictEqual(g.mascotLevel(9).name, 'Bébé caca');
  assert.strictEqual(g.mascotLevel(10).name, 'Petit caca');
  assert.strictEqual(g.mascotLevel(30).remaining, 20);
  assert.strictEqual(g.mascotLevel(30).progress, 0.5);
  const max = g.mascotLevel(1000);
  assert.strictEqual(max.next, null);
  assert.strictEqual(max.progress, 1);
});

test('mascotMood : sans entrée, elle attend le premier caca', () => {
  assert.strictEqual(g.mascotMood([]).mood, 'waiting');
});

test('mascotMood : caca aujourd\'hui -> contente ; 7 jours de série -> fête et lunettes', () => {
  const midi = at(2026, 8, 17, 14);
  assert.strictEqual(g.mascotMood([log(at(2026, 8, 17, 9))], midi).mood, 'happy');
  const semaine = Array.from({ length: 7 }, (_, i) => log(at(2026, 8, 17 - i, 9)));
  const m = g.mascotMood(semaine, midi);
  assert.strictEqual(m.mood, 'party');
  assert.strictEqual(m.accessory, 'glasses');
});

test('mascotMood : plus de 48 h sans caca -> inquiète, avant tout le reste', () => {
  assert.strictEqual(g.mascotMood([log(at(2026, 8, 14, 9))], at(2026, 8, 17, 14)).mood, 'worried');
});

test('mascotMood : du sang noté l\'emporte même un jour de fête', () => {
  const now = at(2026, 8, 17, 14);
  const logs = Array.from({ length: 7 }, (_, i) => log(at(2026, 8, 17 - i, 9)));
  logs[0].health = ['sang'];
  assert.strictEqual(g.mascotMood(logs, now).mood, 'worried');
});

test('mascotMood : série en attente le soir -> elle s\'inquiète et le dit', () => {
  const logs = [1, 2, 3].map(n => log(at(2026, 8, 17 - n, 9)));
  const m = g.mascotMood(logs, at(2026, 8, 17, 20));
  assert.strictEqual(m.mood, 'worried');
  assert.ok(m.message.includes('3 jours'), m.message);
});

test('mascotMood : la nuit sans série en jeu, elle dort', () => {
  assert.strictEqual(g.mascotMood([log(at(2026, 8, 16, 9))], at(2026, 8, 17, 23)).mood, 'sleepy');
});

test('mascotSVG rend un SVG pour chaque humeur et accessoire', () => {
  ['happy', 'party', 'sleepy', 'worried', 'waiting'].forEach(mood =>
    ['none', 'glasses', 'crown'].forEach(acc => {
      const svg = g.mascotSVG(mood, acc);
      assert.ok(svg.includes('<svg') && svg.includes('</svg>'), `${mood}/${acc}`);
    }));
});

test('wrappedSeason : du 15 décembre au 15 janvier, année écoulée', () => {
  assert.strictEqual(g.wrappedSeason(at(2026, 11, 14)), null);
  assert.strictEqual(g.wrappedSeason(at(2026, 11, 20)), 2026);
  assert.strictEqual(g.wrappedSeason(at(2027, 0, 10)), 2026);
  assert.strictEqual(g.wrappedSeason(at(2027, 0, 16)), null);
  assert.strictEqual(g.wrappedSeason(at(2026, 8, 17)), null);
});

// ---------- Partage ----------

test('periodRange : la semaine commence le lundi', () => {
  const jeudi = at(2026, 8, 17, 15);   // jeudi 17 septembre 2026
  const r = g.periodRange('week', jeudi);
  assert.strictEqual(new Date(r.start).getDay(), 1);
  assert.strictEqual(new Date(r.start).getDate(), 14);
  const dimanche = g.periodRange('week', at(2026, 8, 20, 15));
  assert.strictEqual(new Date(dimanche.start).getDate(), 14, 'le dimanche appartient à la semaine du lundi précédent');
});

test('shareCardData : ne compte que la période', () => {
  const now = at(2026, 8, 17, 15);
  const logs = [log(at(2026, 8, 16), { texture: 'mou', duration: 120 }), log(at(2026, 8, 15), { texture: 'mou' }), log(at(2026, 7, 30))];
  const d = g.shareCardData(logs, 'month', now);
  assert.strictEqual(d.total, 2);
  assert.strictEqual(d.topTexture, 'mou');
  assert.strictEqual(d.bestRun, 2);
  assert.strictEqual(d.avgDuration, 120);
  assert.strictEqual(g.shareCardData(logs, 2026, now).total, 3);
});

test('longestRun : jours consécutifs, doublons d\'un même jour ignorés', () => {
  const logs = [at(2026, 2, 1), at(2026, 2, 2, 8), at(2026, 2, 2, 20), at(2026, 2, 3), at(2026, 2, 10)].map(d => log(d));
  assert.strictEqual(g.longestRun(logs), 3);
  assert.strictEqual(g.longestRun([]), 0);
});

test('longestRun traverse le changement d\'heure', () => {
  // Nuit du 28 au 29 mars 2026 : passage à l'heure d'été en France
  const logs = [at(2026, 2, 28), at(2026, 2, 29), at(2026, 2, 30)].map(d => log(d));
  assert.strictEqual(g.longestRun(logs), 3);
});

test('weightComparison : la plus grosse référence qui tient', () => {
  assert.strictEqual(g.weightComparison(0.1), null);
  assert.strictEqual(g.weightComparison(1).ref, 'un ananas');
  const chats = g.weightComparison(5);
  assert.strictEqual(chats.ref, 'un chat');
  assert.strictEqual(chats.times, 1);
  assert.strictEqual(chats.text, 'un chat');
  assert.strictEqual(g.weightComparison(9.9).text, '2 pastèques');
  assert.strictEqual(g.weightComparison(50).ref, 'un labrador');
});

// ---------- Wrapped ----------

test('buildYearWrapped : rien pour une année vide', () => {
  assert.strictEqual(g.buildYearWrapped([log(at(2025, 5, 1))], 2026), null);
});

test('buildYearWrapped : chiffres de l\'année et comparaison à la précédente', () => {
  const logs = [
    log(at(2025, 5, 1)),
    log(at(2026, 2, 1, 8), { place: 'maison', duration: 300 }),
    log(at(2026, 2, 2, 8), { place: 'maison', duration: 100 }),
    log(at(2026, 2, 3, 8), { texture: 'mou', place: 'boulot' }),
    log(at(2026, 2, 3, 21)),
    log(at(2026, 6, 14, 8)),
  ];
  const w = g.buildYearWrapped(logs, 2026);
  assert.strictEqual(w.total, 5);
  assert.strictEqual(w.activeDays, 4);
  assert.strictEqual(w.bestMonth.month, 2);
  assert.strictEqual(w.bestMonth.count, 4);
  assert.strictEqual(w.peakHour, 8);
  assert.strictEqual(w.favTexture.id, 'normal');
  assert.strictEqual(w.normalPct, 80);
  assert.strictEqual(w.bestRun, 3);
  assert.strictEqual(w.bestDay.count, 2);
  assert.strictEqual(new Date(w.bestDay.date).getDate(), 3);
  assert.strictEqual(w.topPlace.id, 'maison');
  assert.strictEqual(w.duration.total, 400);
  assert.strictEqual(w.previousYear.total, 1);
  assert.strictEqual(w.previousYear.diff, 4);
});
