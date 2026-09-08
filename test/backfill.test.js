// Rattrapage PoopMap vers le cloud (v2.15.1).
//
// `poopMapEntriesToPush` décide de ce qui est repoussé une fois vers le cloud
// au premier démarrage suivant la mise à jour. Trop large, on renvoie tout
// l'historique pour rien ; trop étroit, des lieux restent bloqués en local et
// la carte reste vide sur les autres appareils.

const test = require('node:test');
const assert = require('node:assert');
const { loadInto, readGlobals, daysAgo } = require('./helpers/load');

const PM = loadInto('js/poopmap.js').PoopMapModule;

const ctx = loadInto('js/app/app-sync.js', {
  state: { logs: [] },
  $id: () => null,
  $debug: () => {},
  renderAll: () => {},
  saveState: () => {},
  PoopMapModule: PM,
});
const { poopMapEntriesToPush } = readGlobals(ctx, ['poopMapEntriesToPush']);

const log = (o = {}) => ({ id: Math.random(), date: daysAgo(1), texture: 'normal', color: 'marron', ...o });

test('une entrée sans lieu ni position n\'a rien à repousser', () => {
  assert.strictEqual(poopMapEntriesToPush([log(), log(), log()]).length, 0);
});

test('un lieu seul suffit à être repoussé', () => {
  assert.strictEqual(poopMapEntriesToPush([log({ place: 'maison' }), log()]).length, 1);
});

test('une position seule suffit aussi', () => {
  assert.strictEqual(poopMapEntriesToPush([log({ lat: 48.8566, lon: 2.3522 }), log()]).length, 1);
});

test('une zone conquise seule suffit également', () => {
  assert.strictEqual(poopMapEntriesToPush([log({ city: 'Lyon' }), log()]).length, 1);
});

test('chaque entrée concernée n\'est comptée qu\'une fois', () => {
  const complete = log({ place: 'maison', lat: 48.8566, lon: 2.3522, city: 'Paris', country: 'France' });
  assert.strictEqual(poopMapEntriesToPush([complete]).length, 1);
});

test('seules les entrées concernées partent, pas tout l\'historique', () => {
  const logs = [
    ...Array.from({ length: 50 }, () => log()),
    log({ place: 'resto' }),
    log({ lat: 45.76, lon: 4.83 }),
  ];
  const aPousser = poopMapEntriesToPush(logs);
  assert.strictEqual(aPousser.length, 2);
  assert.strictEqual(aPousser.every(l => l.place || 'lat' in l), true);
});

test('une liste vide ou absente ne fait rien planter', () => {
  assert.strictEqual(poopMapEntriesToPush([]).length, 0);
  assert.strictEqual(poopMapEntriesToPush(undefined).length, 0);
});

test('une position incomplète (latitude seule) n\'est pas prise pour une position', () => {
  // hasGeo exige deux nombres : une entrée à moitié écrite ne doit pas partir.
  assert.strictEqual(poopMapEntriesToPush([log({ lat: 48.8566 })]).length, 0);
});
