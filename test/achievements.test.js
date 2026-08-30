// Badges et prédiction — deux modules jamais testés jusqu'ici.
//
// Les badges décident de ce qui s'affiche dans le feed du groupe et déclenchent
// des notifications push aux copines : un badge attribué à tort est visible par
// tout le monde. La prédiction s'affiche en permanence sur le tableau de bord.

const test = require('node:test');
const assert = require('node:assert');
const { loadInto, readGlobals, daysAgo } = require('./helpers/load');

const ctxA = loadInto('js/achievements.js');
const { ACHIEVEMENTS } = readGlobals(ctxA, ['ACHIEVEMENTS']);

const at = (jours, heure) => ({ date: daysAgo(jours, heure), texture: 'normal', color: 'marron' });
const badge = id => Object.values(ACHIEVEMENTS).find(a => a.id === id);

test('le catalogue est cohérent : id, nom et test présents et uniques', () => {
  const tous = Object.values(ACHIEVEMENTS);
  assert.ok(tous.length > 0);
  for (const a of tous) {
    assert.ok(a.id, 'id manquant');
    assert.ok(a.name, `nom manquant pour ${a.id}`);
    assert.strictEqual(typeof a.check, 'function', `check manquant pour ${a.id}`);
  }
  const ids = tous.map(a => a.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'identifiants dupliqués');
});

test('aucun badge ne se débloque sans aucune donnée', () => {
  const debloques = Object.values(ACHIEVEMENTS).filter(a => {
    try { return a.check([]); } catch { return false; }
  });
  assert.deepStrictEqual(debloques.map(a => a.id), [],
    'un badge accordé sur une liste vide serait offert à toute nouvelle inscrite');
});

test('aucun check ne lève sur des données incomplètes', () => {
  // Les entrées anciennes peuvent manquer de mood, de comment, de updated_at.
  const bancals = [
    { date: daysAgo(1, 9) },
    { date: daysAgo(2, 9), texture: 'dur' },
    { date: daysAgo(3, 9), color: 'vert' },
  ];
  for (const a of Object.values(ACHIEVEMENTS)) {
    assert.doesNotThrow(() => a.check(bancals), `${a.id} lève sur des données incomplètes`);
  }
});

test('lève-tôt — 10 cacas avant 8h, borne stricte', () => {
  const b = badge('morning_person');
  assert.strictEqual(b.check(Array.from({ length: 12 }, (_, i) => at(i, 14))), false,
    'des cacas d\'après-midi ne doivent pas débloquer lève-tôt');
  assert.strictEqual(b.check(Array.from({ length: 9 }, (_, i) => at(i, 7))), false,
    '9 ne suffisent pas, le seuil est 10');
  assert.strictEqual(b.check(Array.from({ length: 10 }, (_, i) => at(i, 7))), true);
  assert.strictEqual(b.check(Array.from({ length: 10 }, (_, i) => at(i, 8))), false,
    '8h pile n\'est pas « avant 8h »');
});

test('hibou — 10 cacas à partir de 22h', () => {
  // « après 22h », pas « la nuit » : 3h du matin ne compte pas.
  const b = badge('night_owl');
  assert.strictEqual(b.check(Array.from({ length: 12 }, (_, i) => at(i, 3))), false,
    '3h du matin ne compte pas comme « après 22h »');
  assert.strictEqual(b.check(Array.from({ length: 9 }, (_, i) => at(i, 23))), false,
    '9 ne suffisent pas');
  assert.strictEqual(b.check(Array.from({ length: 10 }, (_, i) => at(i, 22))), true,
    '22h pile compte');
});

test('arc-en-ciel — exige les 5 couleurs de base', () => {
  const b = badge('rainbow');
  const quatre = ['marron', 'vert', 'jaune', 'noir'].map((c, i) => ({ ...at(i, 9), color: c }));
  assert.strictEqual(b.check(quatre), false, '4 couleurs sur 5 ne suffisent pas');
  assert.strictEqual(b.check([...quatre, { ...at(9, 9), color: 'rouge' }]), true);
});

// ---- Prédiction ----

const ctxP = loadInto('js/predictions.js');
const { PredictionEngine } = readGlobals(ctxP, ['PredictionEngine']);

test('prédiction — moins de 2 entrées : pas de prédiction, confiance nulle', () => {
  for (const n of [0, 1]) {
    const p = new PredictionEngine(Array.from({ length: n }, (_, i) => at(i, 9)));
    const r = p.predictNextPoop();
    assert.strictEqual(r.confidence, 0, `${n} entrée(s) ne doit rien prédire`);
  }
});

test('prédiction — accepte une liste dans le désordre', () => {
  // state.logs est trié du plus récent au plus ancien : le moteur doit remettre
  // en ordre croissant lui-même, sinon les intervalles sortent négatifs.
  const desordre = [at(0, 9), at(4, 9), at(2, 9), at(6, 9)];
  const r = new PredictionEngine(desordre).predictNextPoop();
  assert.ok(r.message, 'un message est attendu');
  assert.ok(!/-\d/.test(r.message), `intervalle négatif dans : ${r.message}`);
});

test('prédiction — un rythme régulier donne un message exploitable', () => {
  const reguliers = [6, 5, 4, 3, 2, 1, 0].map(j => at(j, 9));
  const r = new PredictionEngine(reguliers).predictNextPoop();
  assert.ok(typeof r.message === 'string' && r.message.length > 0);
  assert.ok(r.confidence >= 0 && r.confidence <= 100, `confiance hors bornes : ${r.confidence}`);
});

test('heure moyenne — nulle sans données, cohérente sinon', () => {
  assert.strictEqual(new PredictionEngine([]).getAveragePoopTime(), null);
  const r = new PredictionEngine([at(1, 8), at(2, 10)]).getAveragePoopTime();
  assert.strictEqual(r.hour, 9, 'moyenne de 8h et 10h attendue à 9h');
  assert.ok(r.hour >= 0 && r.hour < 24);
  assert.ok(r.minutes >= 0 && r.minutes < 60);
});
