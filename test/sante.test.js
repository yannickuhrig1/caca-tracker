// Durée des séances et carnet de santé (v2.18.0).
//
// `durationStats` alimente la tuile des Stats, les badges Express/Marathon et
// le PDF médical ; `healthInsights` affiche des comparaisons à l'écran et
// `bloodAlert` déclenche un conseil médical : une erreur ici dit quelque chose
// de faux sur la santé de l'utilisatrice.

const test = require('node:test');
const assert = require('node:assert');
const { loadInto, readGlobals, daysAgo } = require('./helpers/load');

const ctx = loadInto('js/app/app-sante.js', { $id: () => null, state: { logs: [] }, esc: String });
const {
  validDuration, formatDuration, durationStats, healthInsights,
  healthTagCounts, bloodAlert, usualEntry, HEALTH_TAGS,
} = readGlobals(ctx, ['validDuration', 'formatDuration', 'durationStats', 'healthInsights',
  'healthTagCounts', 'bloodAlert', 'usualEntry', 'HEALTH_TAGS']);

const log = (o = {}) => ({ id: Math.random(), date: daysAgo(1), texture: 'normal', color: 'marron', ...o });

// ---------- Durée ----------

test('validDuration : bornes de la contrainte SQL (1 s à 3 h)', () => {
  assert.strictEqual(validDuration(1), 1);
  assert.strictEqual(validDuration(10800), 10800);
  assert.strictEqual(validDuration(0), null);
  assert.strictEqual(validDuration(10801), null);
  assert.strictEqual(validDuration(-5), null);
  assert.strictEqual(validDuration('abc'), null);
  assert.strictEqual(validDuration(null), null);
  assert.strictEqual(validDuration(''), null);
  assert.strictEqual(validDuration('90'), 90, 'une chaîne numérique (champ de saisie) est acceptée');
  assert.strictEqual(validDuration(89.6), 90, 'arrondie à la seconde');
});

test('formatDuration : secondes, minutes, heures', () => {
  assert.strictEqual(formatDuration(45), '45 s');
  assert.strictEqual(formatDuration(180), '3 min');
  assert.strictEqual(formatDuration(192), '3 min 12 s');
  assert.strictEqual(formatDuration(3900), '1 h 05 min');
  assert.strictEqual(formatDuration(null), '—');
  assert.strictEqual(formatDuration(0), '—');
  assert.strictEqual(formatDuration(15345), '4 h 15 min', 'un temps total dépasse les 3 h d\'une séance');
});

test('durationStats ignore les entrées sans durée et rend null s\'il n\'y en a aucune', () => {
  assert.strictEqual(durationStats([log(), log()]), null);
  assert.strictEqual(durationStats([]), null);
  const st = durationStats([log({ duration: 60 }), log(), log({ duration: 300 }), log({ duration: 90 })]);
  assert.strictEqual(st.count, 3);
  assert.strictEqual(st.total, 450);
  assert.strictEqual(st.avg, 150);
  assert.strictEqual(st.median, 90);
  assert.strictEqual(st.max, 300);
  assert.strictEqual(st.min, 60);
});

test('durationStats : médiane d\'un nombre pair, express et marathon', () => {
  const st = durationStats([60, 100, 900, 1200].map(d => log({ duration: d })));
  assert.strictEqual(st.median, 500);
  assert.strictEqual(st.express, 2, 'moins de 2 minutes');
  assert.strictEqual(st.marathon, 2, '15 minutes et plus');
});

test('durationStats rattache le record à sa date', () => {
  const quand = daysAgo(3);
  const st = durationStats([log({ duration: 100 }), log({ duration: 700, date: quand })]);
  assert.strictEqual(st.maxDate, quand);
});

// ---------- Carnet de santé ----------

test('les identifiants d\'étiquettes sont uniques (ils partent en base)', () => {
  const ids = HEALTH_TAGS.map(t => t.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  HEALTH_TAGS.forEach(t => assert.ok(['symptome', 'contexte'].includes(t.kind), t.id));
});

test('healthInsights : une étiquette liée à des selles molles ressort', () => {
  const logs = [
    ...Array.from({ length: 4 }, () => log({ texture: 'liquide', health: ['epice'] })),
    log({ texture: 'normal', health: ['epice'] }),
    ...Array.from({ length: 10 }, () => log({ texture: 'normal' })),
  ];
  const [premier] = healthInsights(logs);
  assert.strictEqual(premier.tag, 'epice');
  assert.strictEqual(premier.metric, 'molles');
  assert.strictEqual(premier.avecPct, 80);
  assert.strictEqual(premier.sansPct, 0);
  assert.strictEqual(premier.n, 5);
});

test('healthInsights : moins de 3 occurrences, rien n\'est affirmé', () => {
  const logs = [
    log({ texture: 'liquide', health: ['cafe'] }),
    log({ texture: 'liquide', health: ['cafe'] }),
    ...Array.from({ length: 10 }, () => log()),
  ];
  assert.strictEqual(healthInsights(logs).length, 0);
});

test('healthInsights : un écart faible n\'est pas une trouvaille', () => {
  // 1 molle sur 4 avec, 2 sur 8 sans : même proportion
  const logs = [
    log({ texture: 'mou', health: ['sport'] }), log({ health: ['sport'] }), log({ health: ['sport'] }), log({ health: ['sport'] }),
    log({ texture: 'mou' }), log({ texture: 'mou' }), ...Array.from({ length: 6 }, () => log()),
  ];
  assert.strictEqual(healthInsights(logs).length, 0);
});

test('healthInsights : relie aussi la douleur (humeur) et les selles dures', () => {
  const logs = [
    ...Array.from({ length: 3 }, () => log({ texture: 'dur', mood: 'difficile', health: ['peu-eau'] })),
    ...Array.from({ length: 6 }, () => log()),
  ];
  const r = healthInsights(logs).find(i => i.tag === 'peu-eau');
  assert.ok(r);
  assert.ok(['dures', 'douleur'].includes(r.metric));
  assert.strictEqual(r.avecPct, 100);
});

test('healthTagCounts compte depuis une date et ignore les étiquettes inconnues', () => {
  const r = healthTagCounts([
    log({ health: ['cafe', 'stress'] }),
    log({ health: ['cafe', 'inconnue'] }),
    log({ health: ['cafe'], date: daysAgo(60) }),
  ], daysAgo(30));
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r[0].id, 'cafe');
  assert.strictEqual(r[0].n, 2);
});

test('bloodAlert : deux fois en 14 jours, ou sur la dernière entrée', () => {
  assert.strictEqual(bloodAlert([log(), log()]), null);
  assert.strictEqual(bloodAlert([log({ health: ['sang'], date: daysAgo(3) }), log({ date: daysAgo(1) })]), null,
    'une seule fois, et pas sur la dernière entrée : pas d\'alerte');
  assert.strictEqual(bloodAlert([log({ health: ['sang'], date: daysAgo(1) })]).count, 1);
  const deux = bloodAlert([log({ health: ['sang'], date: daysAgo(10) }), log({ health: ['sang'], date: daysAgo(5) }), log({ date: daysAgo(1) })]);
  assert.strictEqual(deux.count, 2);
  assert.strictEqual(bloodAlert([log({ health: ['sang'], date: daysAgo(40) }), log({ health: ['sang'], date: daysAgo(30) }), log()]), null,
    'au-delà de 14 jours, l\'alerte retombe');
});

// ---------- Comme d'habitude ----------

test('usualEntry : les choix les plus fréquents, rien sous 3 entrées', () => {
  assert.strictEqual(usualEntry([log(), log()]), null);
  const u = usualEntry([
    log({ texture: 'mou', color: 'jaune', place: 'maison' }),
    log({ texture: 'normal', color: 'marron', place: 'maison' }),
    log({ texture: 'normal', color: 'marron', place: 'maison' }),
    log({ texture: 'normal', color: 'marron', place: 'boulot' }),
  ]);
  assert.strictEqual(u.texture, 'normal');
  assert.strictEqual(u.color, 'marron');
  assert.strictEqual(u.place, 'maison');
});

test('usualEntry ne présume pas d\'un lieu trop rare', () => {
  const logs = [
    ...Array.from({ length: 10 }, () => log()),
    log({ place: 'maison' }), log({ place: 'maison' }), log({ place: 'maison' }),
  ];
  assert.strictEqual(usualEntry(logs).place, null, '3 sur 13 : moins de 40 %');
});

test('usualEntry ne regarde que les entrées récentes', () => {
  const anciennes = Array.from({ length: 40 }, (_, i) => log({ texture: 'dur', date: daysAgo(100 + i) }));
  const recentes = Array.from({ length: 30 }, (_, i) => log({ texture: 'mou', date: daysAgo(i) }));
  assert.strictEqual(usualEntry([...anciennes, ...recentes]).texture, 'mou');
});
