// Calendrier mensuel (v2.16.0).
//
// `buildMonthGrid` place chaque caca sur la bonne case. Un décalage d'un jour
// ne saute pas aux yeux sur un calendrier — il faut le tester.

const test = require('node:test');
const assert = require('node:assert');
const { loadInto, readGlobals } = require('./helpers/load');

const ctx = loadInto('js/charts.js', { $id: () => null, $debug: () => {} });
const { buildMonthGrid } = readGlobals(ctx, ['buildMonthGrid']);

// Référence : lundi 15 juin 2026, 12 h.
const NOW = new Date(2026, 5, 15, 12).getTime();
const le = (a, m, j, h = 10) => ({ date: new Date(a, m - 1, j, h).getTime() });

test('la grille fait toujours 6 semaines pleines', () => {
  for (const offset of [0, -1, -2, -13]) {
    const g = buildMonthGrid([], offset, NOW);
    assert.strictEqual(g.cells.length, 42, `offset ${offset}`);
  }
});

test('la grille commence un lundi, même quand le mois commence un dimanche', () => {
  // Novembre 2026 commence un dimanche : la case du lundi 26 octobre ouvre la grille.
  const g = buildMonthGrid([], 5, NOW);
  assert.strictEqual(g.label, 'novembre 2026');
  assert.strictEqual(g.cells[0].day, 26);
  assert.strictEqual(g.cells[0].inMonth, false);
  assert.strictEqual(g.cells[6].day, 1);
  assert.strictEqual(g.cells[6].inMonth, true);
});

test('le mois courant est le mois d\'aujourd\'hui, et aujourd\'hui est marqué', () => {
  const g = buildMonthGrid([], 0, NOW);
  assert.strictEqual(g.label, 'juin 2026');
  const marques = g.cells.filter(c => c.isToday);
  assert.strictEqual(marques.length, 1);
  assert.strictEqual(marques[0].day, 15);
});

test('un offset négatif remonte dans le passé, et passe l\'année', () => {
  assert.strictEqual(buildMonthGrid([], -1, NOW).label, 'mai 2026');
  assert.strictEqual(buildMonthGrid([], -6, NOW).label, 'décembre 2025');
  assert.strictEqual(buildMonthGrid([], -18, NOW).label, 'décembre 2024');
});

test('chaque caca tombe sur son jour', () => {
  const g = buildMonthGrid([le(2026, 6, 3), le(2026, 6, 3), le(2026, 6, 20)], 0, NOW);
  const jour = n => g.cells.find(c => c.inMonth && c.day === n);
  assert.strictEqual(jour(3).count, 2);
  assert.strictEqual(jour(20).count, 1);
  assert.strictEqual(jour(4).count, 0);
});

test('un caca de 23 h reste sur son jour (pas de décalage UTC)', () => {
  const g = buildMonthGrid([le(2026, 6, 10, 23)], 0, NOW);
  assert.strictEqual(g.cells.find(c => c.inMonth && c.day === 10).count, 1);
  assert.strictEqual(g.cells.find(c => c.inMonth && c.day === 11).count, 0);
});

test('les cacas d\'un autre mois ne sont pas comptés dans le total', () => {
  const g = buildMonthGrid([le(2026, 6, 2), le(2026, 5, 28), le(2026, 7, 1)], 0, NOW);
  assert.strictEqual(g.total, 1);
  assert.strictEqual(g.joursActifs, 1);
});

test('le record du mois est le jour le plus chargé', () => {
  const g = buildMonthGrid([le(2026, 6, 4), le(2026, 6, 9), le(2026, 6, 9), le(2026, 6, 9)], 0, NOW);
  assert.strictEqual(g.meilleur.day, 9);
  assert.strictEqual(g.meilleur.count, 3);
});

test('un mois sans caca n\'a pas de record', () => {
  const g = buildMonthGrid([], 0, NOW);
  assert.strictEqual(g.meilleur, null);
  assert.strictEqual(g.total, 0);
});

test('les jours à venir sont marqués comme tels', () => {
  const g = buildMonthGrid([], 0, NOW);
  assert.strictEqual(g.cells.find(c => c.inMonth && c.day === 14).isFuture, false);
  assert.strictEqual(g.cells.find(c => c.inMonth && c.day === 16).isFuture, true);
});

test('on ne peut pas avancer au-delà du mois courant', () => {
  assert.strictEqual(buildMonthGrid([], 0, NOW).peutAvancer, false);
  assert.strictEqual(buildMonthGrid([], -1, NOW).peutAvancer, true);
});

test('on ne peut pas reculer avant le tout premier caca', () => {
  const logs = [le(2026, 4, 10)];                       // premier caca en avril 2026
  assert.strictEqual(buildMonthGrid(logs, -1, NOW).peutReculer, true);   // mai → avril
  assert.strictEqual(buildMonthGrid(logs, -2, NOW).peutReculer, false);  // avril : terminus
});

test('sans aucun caca, la navigation arrière est fermée', () => {
  assert.strictEqual(buildMonthGrid([], 0, NOW).peutReculer, false);
});
