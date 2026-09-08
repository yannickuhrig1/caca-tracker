// Conquête géographique et rareté des badges (v2.15.0).
//
// `conquestStats` alimente les trophées d'exploration, `computeBadges` sert à
// la fois à l'affichage des badges et au calcul de leur rareté dans le groupe :
// une erreur ici décerne (ou refuse) un trophée à tort.

const test = require('node:test');
const assert = require('node:assert');
const { loadInto, readGlobals, daysAgo } = require('./helpers/load');

const PM = loadInto('js/poopmap.js').PoopMapModule;

const ctxBadges = loadInto('js/app/app-badges.js', {
  $id: () => null,
  $debug: () => {},
  calculateStreak: () => 0,
  PoopMapModule: PM,
});
const { computeBadges, RARITY_SKIP } = readGlobals(ctxBadges, ['computeBadges', 'RARITY_SKIP']);
const { BADGE_DEFS } = readGlobals(ctxBadges, ['BADGE_DEFS']);

const log = (o = {}) => ({ id: Math.random(), date: daysAgo(1), texture: 'normal', color: 'marron', ...o });
const done = (logs, id, streak = 0) => computeBadges(logs, streak)[id].done;

// ---------- Conquête ----------

test('conquestStats dédoublonne communes, régions et pays', () => {
  const c = PM.conquestStats([
    log({ city: 'Paris',  region: 'Île-de-France', country: 'France',   countryCode: 'FR' }),
    log({ city: 'Paris',  region: 'Île-de-France', country: 'France',   countryCode: 'FR' }),
    log({ city: 'Lyon',   region: 'Auvergne',      country: 'France',   countryCode: 'FR' }),
    log({ city: 'Bruges', region: 'Flandre',       country: 'Belgique', countryCode: 'BE' }),
  ]);
  assert.strictEqual(c.cities.join('|'), 'Bruges|Lyon|Paris');
  assert.strictEqual(c.countries.map(p => p.name).join('|'), 'Belgique|France');
  assert.strictEqual(c.regions.length, 3);
});

test('conquestStats ignore les entrées sans zone', () => {
  const c = PM.conquestStats([log(), log({ lat: 48.85, lon: 2.35 })]);
  assert.strictEqual(c.cities.length + c.regions.length + c.countries.length, 0);
});

test('hasZone reconnaît une entrée nommée, même partiellement', () => {
  assert.strictEqual(PM.hasZone({ country: 'France' }), true);
  assert.strictEqual(PM.hasZone({ city: 'Lyon' }), true);
  assert.strictEqual(PM.hasZone({ lat: 48.85, lon: 2.35 }), false);
  assert.strictEqual(PM.hasZone(null), false);
});

test('flagEmoji transforme un code ISO en drapeau', () => {
  assert.strictEqual(PM.flagEmoji('FR'), '🇫🇷');
  assert.strictEqual(PM.flagEmoji('be'), '🇧🇪');
  assert.strictEqual(PM.flagEmoji(null), '🏳️');
  assert.strictEqual(PM.flagEmoji('FRA'), '🏳️');
});

// ---------- Trophées de conquête ----------

test('📍 Première Conquête tombe au premier caca géolocalisé', () => {
  assert.strictEqual(done([log()], 'firstDrop'), false);
  assert.strictEqual(done([log({ lat: 48.85, lon: 2.35 })], 'firstDrop'), true);
});

test('🧭 Cartographe demande 10 spots distincts, pas 10 cacas', () => {
  const memeEndroit = Array.from({ length: 12 }, () => log({ lat: 48.8566, lon: 2.3522 }));
  assert.strictEqual(done(memeEndroit, 'cartographe'), false);
  const dixSpots = Array.from({ length: 10 }, (_, i) => log({ lat: 48 + i * 0.05, lon: 2 + i * 0.05 }));
  assert.strictEqual(done(dixSpots, 'cartographe'), true);
});

test('🛂 Passeport Tamponné demande deux pays', () => {
  const fr = [log({ country: 'France', countryCode: 'FR' })];
  assert.strictEqual(done(fr, 'passeport'), false);
  assert.strictEqual(done([...fr, log({ country: 'Belgique', countryCode: 'BE' })], 'passeport'), true);
});

test('🏙️ Touriste et 🚗 Roadtrip comptent communes et régions distinctes', () => {
  const logs = [
    log({ city: 'Paris', region: 'Île-de-France' }),
    log({ city: 'Lyon',  region: 'Auvergne' }),
    log({ city: 'Nice',  region: 'PACA' }),
  ];
  assert.strictEqual(done(logs, 'touriste'), true);
  assert.strictEqual(done(logs, 'roadtrip'), true);
  assert.strictEqual(done(logs.slice(0, 2), 'touriste'), false);
});

test('🥾 Aventurière et ✈️ Long-Courrier se mesurent à la distance au QG', () => {
  // QG à Paris (2 entrées), une escapade à Lyon (~392 km)
  const logs = [
    log({ lat: 48.8566, lon: 2.3522 }),
    log({ lat: 48.8566, lon: 2.3522 }),
    log({ lat: 45.7640, lon: 4.8357 }),
  ];
  assert.strictEqual(done(logs, 'aventuriere'), true);
  assert.strictEqual(done(logs, 'longCourrier'), false);
  const loin = [...logs.slice(0, 2), log({ lat: 40.4168, lon: -3.7038 })];  // Madrid, ~1050 km
  assert.strictEqual(done(loin, 'longCourrier'), true);
});

test('🏕️ Pleine Nature exige le lieu ET la position', () => {
  assert.strictEqual(done([log({ place: 'nature' })], 'pleineNature'), false);
  assert.strictEqual(done([log({ place: 'nature', lat: 45.1, lon: 6.1 })], 'pleineNature'), true);
});

test('sans aucune position, aucun trophée de conquête ne se débloque', () => {
  const etats = computeBadges([log(), log(), log()], 0);
  const conquete = ['firstDrop', 'cartographe', 'touriste', 'roadtrip', 'passeport',
                    'aventuriere', 'longCourrier', 'pleineNature'];
  assert.strictEqual(conquete.filter(id => etats[id].done).length, 0);
});

// ---------- Rareté ----------

test('computeBadges rend un état pour chaque badge défini', () => {
  const etats = computeBadges([log()], 1);
  const manquants = BADGE_DEFS.filter(b => !etats[b.id]);
  assert.strictEqual(manquants.length, 0, 'badges sans condition : ' + manquants.map(b => b.id).join(', '));
});

test('la rareté exclut les badges qu\'on ne peut pas calculer sans les notes ni les positions', () => {
  // Ces données ne sont pas lues chez les copines : afficher « 0/5 » serait faux.
  ['journaliste', 'philosopher', 'novelist', 'firstDrop', 'passeport']
    .forEach(id => assert.ok(RARITY_SKIP.has(id), `${id} devrait être exclu de la rareté`));
  // À l'inverse, un badge calculable doit rester affiché.
  assert.strictEqual(RARITY_SKIP.has('streak7'), false);
});

test('computeBadges ne dépend pas de l\'état global : deux listes, deux résultats', () => {
  const debutante = computeBadges([log()], 1);
  const assidue   = computeBadges(Array.from({ length: 30 }, () => log()), 1);
  assert.strictEqual(debutante.poops25.done, false);
  assert.strictEqual(assidue.poops25.done, true);
});
