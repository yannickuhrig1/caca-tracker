// Test du maïs : le vrai temps de transit, mesuré entre le repas et le caca
// où le maïs réapparaît.
//
// C'est une mesure que Clémence pourrait montrer à un médecin : un calcul faux
// vaudrait mieux que rien seulement s'il était signalé comme faux. On vérifie
// donc le calcul, le refus d'un maïs revu trop tôt (il vient d'un repas
// précédent), l'abandon d'un test oublié, et les seuils du commentaire.

const test = require('node:test');
const assert = require('node:assert');
const { loadInto } = require('./helpers/load');

const M = loadInto('js/app/app-mais.js', {
  $id: () => null, esc: s => String(s), editingId: null, updateBadges: () => {},
});

const H = 3600000;
const now = new Date(2026, 8, 18, 12).getTime();

test('maisStart puis maisFound : le transit est la durée entre les deux', () => {
  const d = M.maisStart(null, now - 30 * H);
  const r = M.maisFound(d, now, now);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(Math.round(r.hours), 30);
  assert.strictEqual(r.data.pending, null, 'le test se termine');
  assert.strictEqual(r.data.results.length, 1);
});

test('sans test en cours, rien à conclure', () => {
  const r = M.maisFound(null, now, now);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'aucun');
});

test('maïs revu moins de 6 h après : c\'est celui d\'avant, le test continue', () => {
  const d = M.maisStart(null, now - 3 * H);
  const r = M.maisFound(d, now, now);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'tot');
  assert.ok(M.maisPending(r.data, now), 'le test reste en cours');
});

test('un test oublié depuis plus de 5 jours ne compte plus', () => {
  const vieux = M.maisStart(null, now - 6 * 24 * H);
  assert.strictEqual(M.maisPending(vieux, now), null);
  assert.strictEqual(M.maisFound(vieux, now, now).reason, 'aucun');
  // Juste avant l'échéance, il tient encore.
  assert.ok(M.maisPending(M.maisStart(null, now - 4.5 * 24 * H), now));
});

test('maisPending : heures écoulées, et un test annulé disparaît', () => {
  const d = M.maisStart(null, now - 14 * H);
  assert.strictEqual(Math.round(M.maisPending(d, now).hours), 14);
  assert.strictEqual(M.maisPending(M.maisCancel(d), now), null);
});

test('maisNormalize : stockage abîmé, résultats impossibles, ordre', () => {
  const d = M.maisNormalize({
    pending: { ateAt: 'oups' },
    results: [
      { ateAt: now - 50 * H, foundAt: now - 20 * H },
      { ateAt: now - 10 * H, foundAt: now - 30 * H },   // retrouvé avant d'être mangé
      { ateAt: null, foundAt: now },
      { ateAt: now - 5 * H, foundAt: now },
    ],
  });
  assert.strictEqual(d.pending, null);
  assert.strictEqual(d.results.length, 2);
  assert.strictEqual(d.results[0].foundAt, now, 'le plus récent d\'abord');
  assert.strictEqual(M.maisNormalize('n\'importe quoi').results.length, 0);
});

test('maisSummary : dernier résultat, moyenne et test en cours', () => {
  let d = M.maisStart(null, now - 40 * H);
  d = M.maisFound(d, now - 10 * H, now).data;
  d = M.maisStart(d, now - 24 * H);
  d = M.maisFound(d, now, now).data;
  const r = M.maisSummary(d, now);
  assert.strictEqual(r.total, 2);
  assert.strictEqual(Math.round(r.dernier.hours), 24);
  assert.strictEqual(Math.round(r.moyenne), 27);
  assert.strictEqual(r.pending, null);
  assert.ok(M.maisSummary(M.maisStart(d, now - H), now).pending);
});

test('transitVerdict : rapide sous 12 h, normal jusqu\'à 3 jours, lent après', () => {
  assert.strictEqual(M.transitVerdict(8).niveau, 'rapide');
  assert.strictEqual(M.transitVerdict(12).niveau, 'normal');
  assert.strictEqual(M.transitVerdict(30).niveau, 'normal');
  assert.strictEqual(M.transitVerdict(72).niveau, 'normal');
  assert.strictEqual(M.transitVerdict(73).niveau, 'lent');
  assert.strictEqual(M.transitVerdict(NaN), null);
});

test('maisFormat : heures, puis jours au-delà de deux jours', () => {
  assert.strictEqual(M.maisFormat(26), '26 h');
  assert.strictEqual(M.maisFormat(47.6), '48 h');
  assert.strictEqual(M.maisFormat(50), '2 j 2 h');
  assert.strictEqual(M.maisFormat(72), '3 j');
  assert.strictEqual(M.maisFormat(null), '—');
});

test('maisBadgeState : gagné dès le premier transit mesuré', () => {
  assert.strictEqual(M.maisBadgeState().done, false);
  M.maisSave(M.maisFound(M.maisStart(null, now - 30 * H), now, now).data);
  assert.strictEqual(M.maisBadgeState().done, true);
});
