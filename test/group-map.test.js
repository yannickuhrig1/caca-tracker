// Carte du groupe (v2.22.0) : couleurs stables par membre, résumé et
// regroupement des positions par membre.
//
// Ces fonctions décident de ce qui s'affiche sur la carte du groupe : une
// couleur qui change entre deux rendus ou un cluster qui mélange deux copines
// rendrait la carte illisible, sans message d'erreur.

const test = require('node:test');
const assert = require('node:assert');
const { loadInto } = require('./helpers/load');

const ctx = loadInto(['js/poopmap.js', 'js/group-map.js']);
const G = ctx.GroupMapModule;

const row = (userId, username, lat, lon, place) => ({
  id: 'x' + Math.random(), user_id: userId, username, avatar: '💩',
  date: Date.now(), texture: 'normal', color: 'marron', place, lat, lon,
});

test('memberColorMap : une couleur unique et stable par membre', () => {
  const rows = [
    row('a', 'Léa', 48.8, 2.3, 'maison'),
    row('b', 'Zoé', 48.9, 2.4, 'boulot'),
    row('a', 'Léa', 48.7, 2.5, 'resto'),
  ];
  const colors = G.memberColorMap(rows);
  assert.strictEqual(Object.keys(colors).length, 2);
  assert.ok(colors.a);
  assert.ok(colors.b);
  assert.notStrictEqual(colors.a, colors.b);
});

test('groupGeoSummary : total, membres et spots distincts', () => {
  const rows = [
    row('a', 'Léa', 48.8, 2.3, 'maison'),
    row('a', 'Léa', 48.8, 2.3, 'maison'), // même spot
    row('b', 'Zoé', 48.9, 2.4, 'boulot'),
  ];
  const s = G.groupGeoSummary(rows);
  assert.strictEqual(s.total, 3);
  assert.strictEqual(s.members, 2);
  assert.strictEqual(s.spots, 2);
  assert.strictEqual(s.withPlace, 3);
});

test('groupGeoSummary : liste vide ou null', () => {
  assert.strictEqual(G.groupGeoSummary(null).total, 0);
  assert.strictEqual(G.groupGeoSummary([]).members, 0);
});

test('emptyStateHTML : message adapté à la situation de partage', () => {
  // Serveur sans la migration 19 → indisponible.
  assert.match(G.emptyStateHTML(true, true), /pas encore disponible/);
  // L'utilisatrice n'a pas activé le partage → on lui dit d'activer.
  assert.match(G.emptyStateHTML(false, false), /Partager ma position/);
  // L'utilisatrice a DÉJÀ activé le partage → on ne lui redemande pas,
  // on lui explique qu'il faut enregistrer des positions.
  const msg = G.emptyStateHTML(false, true);
  assert.match(msg, /Enregistrer la position/);
  assert.doesNotMatch(msg, /Personne n'a encore partagé sa position/);
});

test('clusterByMember : regroupe les points par membre, sans les mélanger', () => {
  const rows = [
    row('a', 'Léa', 48.8, 2.3, 'maison'),
    row('a', 'Léa', 48.8001, 2.3001, 'maison'), // même cluster (3 décimales)
    row('b', 'Zoé', 49.0, 2.5, 'boulot'),
  ];
  const groups = G.clusterByMember(rows);
  assert.strictEqual(groups.length, 2);
  const lea = groups.find(g => g.userId === 'a');
  const zoe = groups.find(g => g.userId === 'b');
  assert.strictEqual(lea.username, 'Léa');
  assert.strictEqual(lea.clusters.length, 1);
  assert.strictEqual(lea.clusters[0].count, 2);
  assert.strictEqual(zoe.clusters[0].count, 1);
});
