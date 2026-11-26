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

test('getTestRows : retourne les entrées géolocalisées du membre test', () => {
  const now = 1700000000000;
  const testRows = G.getTestRows(now);
  assert.ok(Array.isArray(testRows) && testRows.length >= 2);
  for (const r of testRows) {
    assert.strictEqual(r.user_id, G.TEST_USER_ID);
    assert.strictEqual(r.username, 'Testeur');
    assert.strictEqual(r.avatar, '🦊');
    assert.strictEqual(typeof r.lat, 'number');
    assert.strictEqual(typeof r.lon, 'number');
    assert.ok(r.date <= now);
  }
  const spots = new Set(testRows.map(r => `${r.lat}/${r.lon}`));
  assert.ok(spots.size >= 2, 'le membre test doit avoir plusieurs positions distinctes');
});

test('mergeTestRows : fusionne les cacas réels et fictifs sans muter l’entrée', () => {
  const realRows = [row('u1', 'Claire', 48.85, 2.35, 'maison')];
  const merged = G.mergeTestRows(realRows, 1700000000000);
  assert.strictEqual(realRows.length, 1);
  assert.strictEqual(merged.length, 1 + G.getTestRows(1700000000000).length);
  assert.strictEqual(merged[0].user_id, 'u1');
  assert.strictEqual(G.mergeTestRows(null, 1700000000000).length, G.getTestRows(1700000000000).length);
});

test('memberColorMap : couleur distincte entre utilisateur réel et TEST_USER_ID', () => {
  const merged = G.mergeTestRows([
    row('u1', 'Claire', 48.85, 2.35, 'maison'),
    row('u2', 'Léa', 45.76, 4.83, 'boulot'),
  ]);
  const colors = G.memberColorMap(merged);
  assert.strictEqual(Object.keys(colors).length, 3);
  assert.ok(colors.u1 && colors.u2 && colors[G.TEST_USER_ID]);
  assert.notStrictEqual(colors.u1, colors[G.TEST_USER_ID]);
  assert.notStrictEqual(colors.u2, colors[G.TEST_USER_ID]);
  assert.notStrictEqual(colors.u1, colors.u2);
});

test('clusterByMember : sépare les clusters d’un utilisateur réel et du membre test', () => {
  const merged = G.mergeTestRows([
    row('u1', 'Claire', 48.8566, 2.3522, 'maison'), // mêmes coordonnées que test-1/test-2
  ]);
  const groups = G.clusterByMember(merged);
  assert.strictEqual(groups.length, 2);
  const claire = groups.find(g => g.userId === 'u1');
  const testeur = groups.find(g => g.userId === G.TEST_USER_ID);
  assert.ok(claire && testeur);
  assert.strictEqual(claire.clusters.length, 1);
  assert.strictEqual(claire.clusters[0].count, 1);
  assert.strictEqual(testeur.username, 'Testeur');
  assert.strictEqual(testeur.avatar, '🦊');
  assert.strictEqual(testeur.clusters.length, 4);
  assert.strictEqual(testeur.clusters.reduce((sum, c) => sum + c.count, 0), 5);
});

test('emptyStateHTML(false, true) : ne mentionne plus les 30 derniers jours et indique aucun caca géolocalisé', () => {
  const msg = G.emptyStateHTML(false, true);
  assert.doesNotMatch(msg, /30 derniers jours/i);
  assert.match(msg, /aucun caca géolocalisé/i);
});

test('allPoints : conserve tous les spots distincts d’un même utilisateur (ex. maison + Thionville)', () => {
  const rows = [
    row('u1', 'Claire', 48.8566, 2.3522, 'maison'),
    row('u1', 'Claire', 49.3583, 6.1681, 'Thionville'),
  ];
  const groups = G.clusterByMember(rows);
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].clusters.length, 2);

  const pts = G.allPoints(groups);
  assert.strictEqual(pts.length, 2);
  assert.ok(pts.some(p => Math.abs(p.lat - 48.8566) < 0.01 && Math.abs(p.lon - 2.3522) < 0.01));
  assert.ok(pts.some(p => Math.abs(p.lat - 49.3583) < 0.01 && Math.abs(p.lon - 6.1681) < 0.01));
  assert.strictEqual(G.allPoints(null).length, 0);
});
