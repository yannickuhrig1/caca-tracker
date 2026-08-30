// Streak « tolérant » (v2.10.0) : un jour raté est pardonné par un joker 🃏,
// au plus un joker par fenêtre de 7 jours, et seulement si le jour d'avant le
// trou a bien une entrée. Le jour joker ne compte pas dans le total.
//
// C'est la logique la plus subtile de l'app et elle pilote un badge visible
// en permanence dans le header.

const test = require('node:test');
const assert = require('node:assert');
const { loadInto, daysAgo } = require('./helpers/load');

/** Charge app-render.js et calcule le streak pour une liste de jours-en-arrière. */
function streakPour(joursEnArriere) {
  const ctx = loadInto('js/app/app-render.js', {
    state: { logs: joursEnArriere.map(n => ({ date: daysAgo(n) })) },
    $id: () => null,
    $debug: () => {},
    esc: s => String(s),
    textureEmoji: () => '',
    renderDashboard: () => {},
    renderHistory: () => {},
    updateBadges: () => {},
    updateChart: () => {},
  });
  return ctx.calculateStreak();
}

test('aucune entrée aujourd\'hui -> streak 0', () => {
  assert.strictEqual(streakPour([1, 2, 3]), 0);
});

test('liste vide -> streak 0', () => {
  assert.strictEqual(streakPour([]), 0);
});

test('aujourd\'hui seul -> streak 1', () => {
  assert.strictEqual(streakPour([0]), 1);
});

test('4 jours d\'affilée -> streak 4', () => {
  assert.strictEqual(streakPour([0, 1, 2, 3]), 4);
});

test('plusieurs entrées le même jour ne comptent qu\'une fois', () => {
  const ctx = loadInto('js/app/app-render.js', {
    state: { logs: [daysAgo(0, 8), daysAgo(0, 20), daysAgo(1, 9)].map(d => ({ date: d })) },
    $id: () => null, $debug: () => {}, esc: String, textureEmoji: () => '',
    renderDashboard: () => {}, renderHistory: () => {}, updateBadges: () => {}, updateChart: () => {},
  });
  assert.strictEqual(ctx.calculateStreak(), 2);
});

test('un trou isolé est pardonné par le joker et ne compte pas', () => {
  // J0 J1 [J2 manquant] J3 J4  ->  4 jours réels, le joker absorbe J2
  assert.strictEqual(streakPour([0, 1, 3, 4]), 4);
});

test('deux trous consécutifs cassent la série', () => {
  // J0 J1 [J2 et J3 manquants] : le joker ne couvre qu'un seul jour, et le
  // jour précédant le second trou n'a pas d'entrée.
  assert.strictEqual(streakPour([0, 1, 4, 5]), 2);
});

test('un second joker est refusé à moins de 7 jours du premier', () => {
  // Trous en J2 et J5 : seuls 3 jours les séparent, le second n'est pas pardonné.
  // Série retenue : J0, J1, (joker J2), J3, J4 = 4
  assert.strictEqual(streakPour([0, 1, 3, 4, 6, 7, 8]), 4);
});

test('un second joker est accepté au-delà de 7 jours', () => {
  // Trous en J2 et J9 : 7 jours d'écart, les deux jokers passent.
  // Comptés : 0,1,3,4,5,6,7,8,10,11 = 10
  assert.strictEqual(streakPour([0, 1, 3, 4, 5, 6, 7, 8, 10, 11]), 10);
});

test('le joker exige une entrée la veille du trou', () => {
  // J0 présent, J1 manquant, J2 manquant : le joker regarde J2 pour pardonner
  // J1 — comme J2 est vide, la série s'arrête à 1.
  assert.strictEqual(streakPour([0, 3, 4]), 1);
});
