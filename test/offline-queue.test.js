// File d'attente hors ligne : plafond et abandon après N tentatives.
//
// Le bug corrigé ici : un item qui échouait pour une raison définitive était
// remis en file à chaque passe, donc réessayé indéfiniment, et la file n'avait
// aucun plafond — un long passage hors ligne pouvait saturer le localStorage
// et faire perdre en silence les entrées suivantes.

const test = require('node:test');
const assert = require('node:assert');
const { loadInto, readGlobals } = require('./helpers/load');

const ctx = loadInto('js/app/app-sync.js', {
  $id: () => null, $debug: () => {}, esc: String,
  state: { logs: [] }, Chart: function () {},
});
const { pushToQueue, triageQueue } = ctx;
const { QUEUE_MAX, QUEUE_MAX_ESSAIS } = readGlobals(ctx, ['QUEUE_MAX', 'QUEUE_MAX_ESSAIS']);

const item = n => ({ type: 'add', poop: { id: n } });

// ---- pushToQueue : le plafond ----

test('pushToQueue — sous le plafond, rien n\'est écarté', () => {
  const r = pushToQueue([item(1)], item(2), 10);
  assert.strictEqual(r.queue.length, 2);
  assert.strictEqual(r.ecartes.length, 0);
});

test('pushToQueue — initialise le compteur de tentatives à 0', () => {
  const r = pushToQueue([], item(1), 10);
  assert.strictEqual(r.queue[0].essais, 0);
});

test('pushToQueue — au plafond, écarte les PLUS ANCIENS', () => {
  const pleine = Array.from({ length: 3 }, (_, i) => item(i));
  const r = pushToQueue(pleine, item(99), 3);
  assert.strictEqual(r.queue.length, 3, 'la file reste au plafond');
  assert.strictEqual(r.ecartes.length, 1);
  assert.strictEqual(r.ecartes[0].poop.id, 0, 'le plus ancien part');
  assert.strictEqual(r.queue[2].poop.id, 99, 'le nouveau est conservé');
});

test('pushToQueue — le plafond réel est un nombre exploitable', () => {
  assert.ok(Number.isInteger(QUEUE_MAX) && QUEUE_MAX > 0, `QUEUE_MAX = ${QUEUE_MAX}`);
});

// ---- triageQueue : l'abandon ----

test('triageQueue — un succès ne revient dans aucune liste', () => {
  const r = triageQueue([{ item: item(1), ok: true }]);
  assert.strictEqual(r.aReessayer.length, 0);
  assert.strictEqual(r.abandonnes.length, 0);
});

test('triageQueue — un échec incrémente le compteur et repart en file', () => {
  const r = triageQueue([{ item: { ...item(1), essais: 0 }, ok: false }], 5);
  assert.strictEqual(r.aReessayer.length, 1);
  assert.strictEqual(r.aReessayer[0].essais, 1);
  assert.strictEqual(r.abandonnes.length, 0);
});

test('triageQueue — au N-ième échec, l\'item est abandonné et non réessayé', () => {
  const r = triageQueue([{ item: { ...item(1), essais: 4 }, ok: false }], 5);
  assert.strictEqual(r.abandonnes.length, 1, 'doit être abandonné');
  assert.strictEqual(r.aReessayer.length, 0, 'ne doit PAS revenir en file');
  assert.strictEqual(r.abandonnes[0].essais, 5);
});

test('triageQueue — un item sans compteur est traité comme neuf', () => {
  const r = triageQueue([{ item: item(1), ok: false }], 5);
  assert.strictEqual(r.aReessayer[0].essais, 1);
});

test('triageQueue — la boucle converge : rien ne survit indéfiniment', () => {
  // C'est le cœur du bug : on simule un item qui échoue toujours et on vérifie
  // qu'il finit par sortir de la file au lieu d'y rester pour toujours.
  let file = [{ ...item(1), essais: 0 }];
  let passes = 0;
  while (file.length && passes < 50) {
    file = triageQueue(file.map(i => ({ item: i, ok: false })), 5).aReessayer;
    passes++;
  }
  assert.strictEqual(file.length, 0, 'la file doit finir vide');
  assert.strictEqual(passes, 5, `abandon attendu à la 5e passe, obtenu ${passes}`);
});

test('triageQueue — succès et échecs mêlés sont triés correctement', () => {
  const r = triageQueue([
    { item: { ...item(1), essais: 0 }, ok: true  },
    { item: { ...item(2), essais: 1 }, ok: false },
    { item: { ...item(3), essais: 4 }, ok: false },
  ], 5);
  assert.strictEqual(r.aReessayer.length, 1);
  assert.strictEqual(r.aReessayer[0].poop.id, 2);
  assert.strictEqual(r.abandonnes.length, 1);
  assert.strictEqual(r.abandonnes[0].poop.id, 3);
});

test('le seuil de tentatives est fini', () => {
  assert.ok(Number.isInteger(QUEUE_MAX_ESSAIS) && QUEUE_MAX_ESSAIS > 0 && QUEUE_MAX_ESSAIS < 100,
    `QUEUE_MAX_ESSAIS = ${QUEUE_MAX_ESSAIS}`);
});
