// Échelle de Bristol (v2.17.0).
//
// La version précédente rattachait « dur » aux types 1 ET 2, et « normal » aux
// types 3 ET 4 : chaque selle était comptée deux fois et les pourcentages ne
// tombaient jamais juste. Ces tests verrouillent le comptage.

const test = require('node:test');
const assert = require('node:assert');
const { loadInto, readGlobals } = require('./helpers/load');

const ctx = loadInto('js/app/app-health.js', {
  state: { logs: [] },
  $id: () => null,
  $debug: () => {},
  esc: s => String(s),
});
const { bristolBreakdown } = readGlobals(ctx, ['bristolBreakdown']);

const t = texture => ({ texture, date: Date.now() });

test('chaque selle n\'est comptée qu\'une seule fois', () => {
  const logs = [t('dur'), t('normal'), t('mou'), t('spray'), t('liquide'), t('explosif')];
  const { rows, total } = bristolBreakdown(logs);
  assert.strictEqual(total, 6);
  assert.strictEqual(rows.reduce((n, r) => n + r.count, 0), 6);
});

test('les pourcentages somment à 100 %', () => {
  const logs = [t('normal'), t('normal'), t('dur'), t('mou')];
  const { rows } = bristolBreakdown(logs);
  assert.strictEqual(rows.reduce((n, r) => n + r.pct, 0), 100);
});

test('chaque texture tombe sur son type', () => {
  const type = (logs, num) => bristolBreakdown(logs).rows.find(r => r.num === num).count;
  assert.strictEqual(type([t('dur')], 2), 1);
  assert.strictEqual(type([t('normal')], 4), 1);
  assert.strictEqual(type([t('mou')], 5), 1);
  assert.strictEqual(type([t('spray')], 6), 1);
});

test('liquide et explosif se rejoignent sur le type 7', () => {
  const { rows } = bristolBreakdown([t('liquide'), t('explosif')]);
  assert.strictEqual(rows.find(r => r.num === 7).count, 2);
});

test('les types 1 et 3 sont marqués inatteignables, les autres non', () => {
  const { rows } = bristolBreakdown([t('normal')]);
  assert.strictEqual(rows.find(r => r.num === 1).inatteignable, true);
  assert.strictEqual(rows.find(r => r.num === 3).inatteignable, true);
  assert.strictEqual(rows.filter(r => r.inatteignable).length, 2);
  assert.strictEqual(rows.find(r => r.num === 4).inatteignable, false);
});

test('la part idéale ne compte que les types 3 et 4', () => {
  const { idealPct } = bristolBreakdown([t('normal'), t('normal'), t('dur'), t('liquide')]);
  assert.strictEqual(idealPct, 50);
});

test('aucune selle : rien ne plante, tout est à zéro', () => {
  const { rows, total, idealPct } = bristolBreakdown([]);
  assert.strictEqual(total, 0);
  assert.strictEqual(idealPct, 0);
  assert.strictEqual(rows.every(r => r.count === 0 && r.pct === 0), true);
});
