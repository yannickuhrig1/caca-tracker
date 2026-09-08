// Graphiques de l'onglet Stats (v2.17.0).
//
// Ces fonctions décident de ce que les barres montrent. Une erreur de créneau
// ou de jour de la semaine produit un graphique parfaitement lisible... et faux.

const test = require('node:test');
const assert = require('node:assert');
const { loadInto, readGlobals } = require('./helpers/load');

const ctx = loadInto('js/charts.js', { $id: () => null, $debug: () => {} });
const { buildHourSlots, buildWeekdayBars, buildMonthlyTrend, buildShare, TEXTURES_META } =
  readGlobals(ctx, ['buildHourSlots', 'buildWeekdayBars', 'buildMonthlyTrend', 'buildShare', 'TEXTURES_META']);

const a = (annee, mois, jour, heure = 10) => ({ date: new Date(annee, mois - 1, jour, heure).getTime() });

// ---------- Heures ----------

test('les 24 heures se rangent dans 12 créneaux de 2 h', () => {
  const { slots } = buildHourSlots([]);
  assert.strictEqual(slots.length, 12);
  assert.strictEqual(slots[0].label, '00–02 h');
  assert.strictEqual(slots[11].label, '22–24 h');
});

test('une heure tombe dans son créneau, bornes comprises', () => {
  const { slots } = buildHourSlots([a(2026, 6, 1, 0), a(2026, 6, 1, 1), a(2026, 6, 1, 2), a(2026, 6, 1, 23)]);
  assert.strictEqual(slots[0].count, 2);   // 0 h et 1 h
  assert.strictEqual(slots[1].count, 1);   // 2 h
  assert.strictEqual(slots[11].count, 1);  // 23 h
});

test('le pic est le créneau le plus fourni', () => {
  const { pic, total } = buildHourSlots([a(2026, 6, 1, 8), a(2026, 6, 2, 9), a(2026, 6, 3, 15)]);
  assert.strictEqual(pic.label, '08–10 h');
  assert.strictEqual(pic.count, 2);
  assert.strictEqual(total, 3);
});

test('sans donnée, pas de pic inventé', () => {
  const { pic, total, max } = buildHourSlots([]);
  assert.strictEqual(pic, null);
  assert.strictEqual(total, 0);
  assert.strictEqual(max, 0);
});

// ---------- Jours de la semaine ----------

test('la semaine commence le lundi, pas le dimanche', () => {
  const { bars } = buildWeekdayBars([]);
  assert.strictEqual(bars[0].label, 'Lun');
  assert.strictEqual(bars[6].label, 'Dim');
});

test('un caca du dimanche compte pour dimanche', () => {
  // 7 juin 2026 = dimanche, 8 juin = lundi
  const { bars } = buildWeekdayBars([a(2026, 6, 7), a(2026, 6, 8)]);
  assert.strictEqual(bars[6].count, 1, 'dimanche');
  assert.strictEqual(bars[0].count, 1, 'lundi');
});

test('le jour record est bien le plus chargé', () => {
  const { record, total } = buildWeekdayBars([a(2026, 6, 3), a(2026, 6, 10), a(2026, 6, 8)]);
  assert.strictEqual(record.label, 'Mer');   // 3 et 10 juin 2026 sont des mercredis
  assert.strictEqual(record.count, 2);
  assert.strictEqual(total, 3);
});

// ---------- Tendance 12 mois ----------

test('la courbe couvre douze mois et finit sur le mois courant', () => {
  const now = new Date(2026, 5, 15).getTime();
  const { points } = buildMonthlyTrend([], now);
  assert.strictEqual(points.length, 12);
  assert.strictEqual(points[11].mois, 5);
  assert.strictEqual(points[11].annee, 2026);
  assert.strictEqual(points[0].mois, 6);       // juillet
  assert.strictEqual(points[0].annee, 2025);   // de l'année précédente
});

test('un caca plus vieux que douze mois n\'entre pas dans la courbe', () => {
  // Fenêtre : juillet 2025 → juin 2026. Juin 2025 est déjà dehors.
  const now = new Date(2026, 5, 15).getTime();
  const { points } = buildMonthlyTrend([a(2025, 7, 1), a(2025, 6, 30), a(2024, 1, 1)], now);
  assert.strictEqual(points.reduce((n, p) => n + p.count, 0), 1);
  assert.strictEqual(points[0].count, 1, 'le mois le plus ancien de la fenêtre est juillet 2025');
});

test('la variation compare à la MÊME PORTION du mois précédent', () => {
  // Le 15 juin : on compare juin (2 cacas) au 1er→15 mai (2 cacas), pas à mai
  // entier (4). Sinon un mois à peine commencé afficherait toujours un plongeon.
  const now = new Date(2026, 5, 15).getTime();
  const logs = [a(2026, 5, 1), a(2026, 5, 2),      // mai, avant le 15
                a(2026, 5, 25), a(2026, 5, 28),    // mai, après le 15
                a(2026, 6, 1), a(2026, 6, 2)];     // juin
  const t = buildMonthlyTrend(logs, now);
  assert.strictEqual(t.referenceAvant, 2, 'seuls les 15 premiers jours de mai comptent');
  assert.strictEqual(t.variation, 0, 'même rythme : aucune variation');
});

test('une vraie hausse reste visible', () => {
  const now = new Date(2026, 5, 10).getTime();
  const logs = [a(2026, 5, 3),                                   // mai : 1 avant le 10
                a(2026, 6, 1), a(2026, 6, 2), a(2026, 6, 3)];    // juin : 3
  assert.strictEqual(buildMonthlyTrend(logs, now).variation, 200);
});

test('sans mois précédent, aucune variation n\'est affichée', () => {
  const now = new Date(2026, 5, 15).getTime();
  assert.strictEqual(buildMonthlyTrend([a(2026, 6, 1)], now).variation, null);
});

// ---------- Parts (textures, couleurs) ----------

test('les parts sont triées et somment à 100 %', () => {
  const logs = [{ texture: 'normal' }, { texture: 'normal' }, { texture: 'dur' }, { texture: 'mou' }];
  const parts = buildShare(logs, 'texture', TEXTURES_META);
  assert.strictEqual(parts[0].cle, 'normal');
  assert.strictEqual(parts[0].pct, 50);
  assert.strictEqual(parts.reduce((n, p) => n + p.pct, 0), 100);
});

test('une valeur absente n\'apparaît pas dans les parts', () => {
  const parts = buildShare([{ texture: 'dur' }, { texture: null }, {}], 'texture', TEXTURES_META);
  assert.strictEqual(parts.length, 1);
  assert.strictEqual(parts[0].count, 1);
});
