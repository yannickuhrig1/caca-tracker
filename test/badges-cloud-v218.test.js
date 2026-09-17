// Badges v2.18.0 et lignes envoyées au cloud.
//
// Côté badges : chaque badge doit être rangé dans une catégorie (sinon il
// disparaît de l'onglet), et le carnet de santé ne doit jamais servir à la
// rareté calculée sur les données des copines.
// Côté cloud : la durée doit respecter la contrainte SQL, et une base sans la
// migration 15 ne doit pas faire perdre le caca.

const test = require('node:test');
const assert = require('node:assert');
const { loadInto, readGlobals, daysAgo } = require('./helpers/load');

const PM = loadInto('js/poopmap.js').PoopMapModule;
const ctxBadges = loadInto('js/app/app-badges.js', {
  $id: () => null, $debug: () => {}, calculateStreak: () => 0, PoopMapModule: PM,
});
const B = readGlobals(ctxBadges, ['BADGE_DEFS', 'BADGE_CATEGORIES', 'computeBadges', 'nextBadges', 'rarityTier', 'RARITY_SKIP']);

const log = (o = {}) => ({ id: Math.random(), date: daysAgo(1), texture: 'normal', color: 'marron', ...o });

// ---------- Catégories ----------

test('chaque badge est rangé dans exactement une catégorie', () => {
  const vus = {};
  B.BADGE_CATEGORIES.forEach(c => c.ids.forEach(id => { vus[id] = (vus[id] || 0) + 1; }));
  B.BADGE_DEFS.forEach(b => assert.strictEqual(vus[b.id], 1, `${b.id} : ${vus[b.id] || 0} catégorie(s)`));
  Object.keys(vus).forEach(id => assert.ok(B.BADGE_DEFS.some(b => b.id === id), `catégorie cite un badge inconnu : ${id}`));
});

test('75 badges au total', () => {
  assert.strictEqual(B.BADGE_DEFS.length, 75);
});

// ---------- Nouveaux badges ----------

test('chrono, express et marathon lisent la durée', () => {
  const e = B.computeBadges([log({ duration: 60 }), log({ duration: 90 }), log({ duration: 30 }), log({ duration: 100 }), log({ duration: 110 })], 0);
  assert.strictEqual(e.chrono.done, true);
  assert.strictEqual(e.express.done, true);
  assert.strictEqual(e.marathon.done, false);
  assert.strictEqual(B.computeBadges([log({ duration: 900 })], 0).marathon.done, true);
  assert.strictEqual(B.computeBadges([log({ duration: 20000 })], 0).chrono.done, false, 'durée aberrante ignorée');
});

test('carnet et hydratée lisent le carnet de santé', () => {
  const logs = Array.from({ length: 10 }, () => log({ health: ['hydratee'] }));
  const e = B.computeBadges(logs, 0);
  assert.strictEqual(e.carnet.done, true);
  assert.strictEqual(e.hydratee.done, true);
  assert.strictEqual(B.computeBadges(logs.slice(0, 9), 0).carnet.done, false);
});

test('les badges du carnet de santé sont exclus de la rareté (données privées)', () => {
  assert.ok(B.RARITY_SKIP.has('carnet'));
  assert.ok(B.RARITY_SKIP.has('hydratee'));
  assert.strictEqual(B.RARITY_SKIP.has('marathon'), false, 'la durée, elle, est lisible du groupe');
});

// ---------- À portée ----------

test('nextBadges : les plus avancés, sans les gagnés ni ceux à 0 %', () => {
  const etats = B.computeBadges(Array.from({ length: 8 }, () => log()), 0);
  const prochains = B.nextBadges(etats, 3);
  assert.strictEqual(prochains.length, 3);
  prochains.forEach(b => assert.ok(b.pct > 0 && b.pct < 100 && !b.done, b.id));
  assert.ok(prochains.some(b => b.id === 'veteran'), '8/10 : parmi les plus proches');
  assert.ok(prochains[0].pct >= prochains[1].pct && prochains[1].pct >= prochains[2].pct, 'triés du plus avancé au moins avancé');
});

// ---------- Rareté ----------

test('rarityTier : paliers selon la part du groupe', () => {
  assert.strictEqual(B.rarityTier(1, 1), null, 'seule, pas de rareté');
  assert.strictEqual(B.rarityTier(0, 4).id, 'inedit');
  assert.strictEqual(B.rarityTier(1, 5).id, 'legendaire');
  assert.strictEqual(B.rarityTier(1, 2).id, 'rare', 'à deux, être seule vaut la moitié');
  assert.strictEqual(B.rarityTier(2, 6).id, 'epique');
  assert.strictEqual(B.rarityTier(3, 6).id, 'rare');
  assert.strictEqual(B.rarityTier(5, 6).id, 'commun');
});

// ---------- Cloud ----------

const ctxCloud = loadInto('js/supabase-client.js');
const C = readGlobals(ctxCloud, ['poopRow', 'cleanDuration', 'healthRow', 'dropMissingColumns', 'isMissingTable']);
const flags = () => readGlobals(ctxCloud, ['_geoColumns', '_durationColumn']);

test('poopRow : durée incluse si la colonne existe, nettoyée', () => {
  const r = C.poopRow({ id: 12, date: 1, texture: 'normal', color: 'marron', duration: 95.4 }, 'u1', { geo: false, duration: true });
  assert.strictEqual(r.duration_s, 95);
  assert.strictEqual(r.local_id, '12');
  assert.strictEqual('place' in r, false);
  const sans = C.poopRow({ id: 12, date: 1, duration: 95 }, 'u1', { geo: true, duration: false });
  assert.strictEqual('duration_s' in sans, false);
  assert.strictEqual(sans.place, null);
  assert.strictEqual(C.poopRow({ id: 1, duration: 99999 }, 'u', { geo: false, duration: true }).duration_s, null,
    'hors contrainte SQL : envoyé à null plutôt que rejeté');
});

test('healthRow : étiquettes dédoublonnées, jamais de valeur vide', () => {
  const r = C.healthRow({ id: 5, health: ['cafe', 'cafe', '', null, 'stress'], updated_at: 9 }, 'u1');
  assert.deepStrictEqual([...r.tags], ['cafe', 'stress']);
  assert.strictEqual(r.local_id, '5');
  assert.strictEqual(C.healthRow({ id: 6 }, 'u1').tags.length, 0);
});

test('dropMissingColumns : retire la durée puis la position, une à la fois', () => {
  assert.strictEqual(C.dropMissingColumns({ code: '23505', message: 'duplicate' }), false, 'autre erreur : pas de rejeu');
  assert.strictEqual(C.dropMissingColumns({ code: 'PGRST204', message: "Could not find the 'duration_s' column of 'poops'" }), true);
  assert.strictEqual(flags()._durationColumn, false);
  assert.strictEqual(flags()._geoColumns, true, 'la position n\'est pas touchée pour une erreur sur la durée');
  assert.strictEqual(C.dropMissingColumns({ code: 'PGRST204', message: "Could not find the 'place' column of 'poops'" }), true);
  assert.strictEqual(flags()._geoColumns, false);
  assert.strictEqual(C.dropMissingColumns({ code: 'PGRST204', message: "Could not find the 'place' column of 'poops'" }), false,
    'déjà retirée : on ne boucle pas');
});

test('isMissingTable reconnaît la table de santé absente', () => {
  assert.strictEqual(C.isMissingTable({ code: 'PGRST205' }), true);
  assert.strictEqual(C.isMissingTable({ code: '42P01' }), true);
  assert.strictEqual(C.isMissingTable({ code: '42501' }), false);
  assert.strictEqual(C.isMissingTable(null), false);
});

// ---------- Synchro et raccourcis ----------

const ctxSync = loadInto('js/app/app-sync.js', { state: { logs: [] }, $id: () => null, $debug: () => {}, renderAll: () => {}, saveState: () => {} });
const S = readGlobals(ctxSync, ['applyExtraFields', 'extraEntriesToPush']);

test('applyExtraFields : base sans migration 15, le local est conservé', () => {
  const local = { duration: 120, health: ['cafe'] };
  S.applyExtraFields(local, {}, { duration: false, health: false });
  assert.strictEqual(local.duration, 120);
  assert.strictEqual(local.health[0], 'cafe');
});

test('applyExtraFields : base à jour, le cloud fait foi (effacement compris)', () => {
  const local = { duration: 120, health: ['cafe'] };
  S.applyExtraFields(local, { duration: 60 }, { duration: true, health: true });
  assert.strictEqual(local.duration, 60);
  assert.strictEqual('health' in local, false);
});

test('extraEntriesToPush : seulement les entrées avec durée ou santé', () => {
  const r = S.extraEntriesToPush([{ id: 1 }, { id: 2, duration: 30 }, { id: 3, health: [] }, { id: 4, health: ['sport'] }]);
  assert.deepStrictEqual(r.map(x => x.id), [2, 4]);
});

const ctxSaisie = loadInto(['js/app/app-sante.js', 'js/app/app-saisie.js'], { $id: () => null, state: { logs: [] }, URLSearchParams });
const { launchAction } = readGlobals(ctxSaisie, ['launchAction']);

test('launchAction : seules les actions connues sont suivies', () => {
  assert.strictEqual(launchAction('?action=add'), 'add');
  assert.strictEqual(launchAction('?join=ABC&action=timer'), 'timer');
  assert.strictEqual(launchAction('?action=wrapped'), 'wrapped');
  assert.strictEqual(launchAction('?action=supprimer-tout'), null);
  assert.strictEqual(launchAction(''), null);
});
