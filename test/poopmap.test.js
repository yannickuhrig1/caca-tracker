// PoopMap (v2.14.0) : classement des lieux, regroupement des positions et
// maths de la carte (projection Web Mercator « slippy map »).
//
// Ces fonctions décident de ce qui s'affiche sur la carte : un cadrage faux et
// les pastilles sortent de l'écran sans que rien ne signale l'erreur.

const test = require('node:test');
const assert = require('node:assert');
const { loadInto } = require('./helpers/load');

const PM = loadInto('js/poopmap.js').PoopMapModule;

// Les valeurs viennent d'un autre realm (node:vm) : deepStrictEqual les refuse
// même à structure identique. On compare donc des valeurs simples.
const proche = (a, b, tol) => Math.abs(a - b) < tol;

const log = (place, lat, lon) => {
  const l = { id: Math.random(), date: Date.now(), texture: 'normal', place };
  if (lat !== undefined) { l.lat = lat; l.lon = lon; }
  return l;
};

// ---------- Lieux ----------

test('placeStats classe les lieux du plus fréquenté au moins fréquenté', () => {
  const stats = PM.placeStats([
    log('boulot'), log('maison'), log('maison'), log('maison'), log('resto'),
  ]);
  assert.strictEqual(stats.map(s => s.id).join('|'), 'maison|boulot|resto');
  assert.strictEqual(stats[0].count, 3);
  assert.strictEqual(stats[0].pct, 60);
});

test('placeStats ignore les entrées sans lieu et les lieux inconnus', () => {
  const stats = PM.placeStats([log('maison'), log(null), log('lune'), {}]);
  assert.strictEqual(stats.length, 1);
  assert.strictEqual(stats[0].count, 1);
});

test('placeStats sur une liste vide ne renvoie rien', () => {
  assert.strictEqual(PM.placeStats([]).length, 0);
  assert.strictEqual(PM.placeStats(undefined).length, 0);
});

// ---------- Position ----------

test('hasGeo n\'accepte que deux nombres finis', () => {
  assert.strictEqual(PM.hasGeo({ lat: 48.85, lon: 2.35 }), true);
  assert.strictEqual(PM.hasGeo({ lat: 48.85 }), false);
  assert.strictEqual(PM.hasGeo({ lat: '48.85', lon: '2.35' }), false);
  assert.strictEqual(PM.hasGeo({ lat: NaN, lon: 2.35 }), false);
  assert.strictEqual(PM.hasGeo(null), false);
});

test('roundCoord arrondit à 4 décimales (~11 m)', () => {
  assert.strictEqual(PM.roundCoord(48.8566123456), 48.8566);
  assert.strictEqual(PM.roundCoord(-2.3599999), -2.36);
});

test('distanceKm : Paris → Lyon ≈ 392 km', () => {
  const km = PM.distanceKm({ lat: 48.8566, lon: 2.3522 }, { lat: 45.7640, lon: 4.8357 });
  assert.ok(proche(km, 392, 5), `attendu ~392 km, obtenu ${km}`);
});

test('distanceKm : deux fois le même point = 0', () => {
  assert.strictEqual(PM.distanceKm({ lat: 48.85, lon: 2.35 }, { lat: 48.85, lon: 2.35 }), 0);
});

// ---------- Regroupement ----------

test('clusterPoints regroupe les positions voisines et compte les entrées', () => {
  const clusters = PM.clusterPoints([
    log('maison', 48.8566, 2.3522),
    log('maison', 48.85661, 2.35221),   // même arrondi au 3e décimal
    log('boulot', 48.8700, 2.3300),
    log('resto'),                        // sans position : ignorée
  ]);
  assert.strictEqual(clusters.length, 2);
  assert.strictEqual(clusters[0].count, 2);   // trié par fréquence
  assert.strictEqual(clusters[1].count, 1);
});

test('clusterPoints sans aucune position renvoie une liste vide', () => {
  assert.strictEqual(PM.clusterPoints([log('maison'), log('boulot')]).length, 0);
});

test('geoStats désigne le spot le plus fréquenté comme QG', () => {
  const stats = PM.geoStats([
    log('maison', 48.8566, 2.3522),
    log('maison', 48.8566, 2.3522),
    log('resto',  45.7640, 4.8357),
  ]);
  assert.strictEqual(stats.spots, 2);
  assert.strictEqual(stats.geoloc, 3);
  assert.strictEqual(stats.hqPlace, 'maison');
  assert.ok(proche(stats.farthestKm, 392, 5), `attendu ~392 km, obtenu ${stats.farthestKm}`);
});

test('geoStats renvoie null quand rien n\'est géolocalisé', () => {
  assert.strictEqual(PM.geoStats([log('maison')]), null);
});

// ---------- Maths de la carte ----------

test('lonToTileX / latToTileY : Paris tombe sur la tuile connue au zoom 12', () => {
  // Référence OSM : 48.8566/2.3522 → tuile 2074/1409 au zoom 12
  assert.strictEqual(Math.floor(PM.lonToTileX(2.3522, 12)), 2074);
  assert.strictEqual(Math.floor(PM.latToTileY(48.8566, 12)), 1409);
});

test('la projection est réversible', () => {
  const z = 14;
  const lat = 48.8566, lon = 2.3522;
  assert.ok(proche(PM.tileXToLon(PM.lonToTileX(lon, z), z), lon, 1e-9));
  assert.ok(proche(PM.tileYToLat(PM.latToTileY(lat, z), z), lat, 1e-9));
});

test('fitView renvoie null sans point géolocalisé', () => {
  assert.strictEqual(PM.fitView([], 320, 260), null);
  assert.strictEqual(PM.fitView([log('maison')], 320, 260), null);
});

test('fitView sur un point unique : centré dessus, zoom raisonnable', () => {
  const v = PM.fitView([log('maison', 48.8566, 2.3522)], 320, 260);
  // Le centre repasse par la projection : on tolère l'erreur d'arrondi flottante.
  assert.ok(proche(v.lat, 48.8566, 1e-9), `latitude décalée : ${v.lat}`);
  assert.ok(proche(v.lon, 2.3522, 1e-9), `longitude décalée : ${v.lon}`);
  assert.ok(v.zoom <= 16 && v.zoom >= 12, `zoom inattendu : ${v.zoom}`);
});

test('fitView : tous les points tiennent dans le cadre', () => {
  const width = 320, height = 260, padding = 34;
  const points = [
    log('maison', 48.8566, 2.3522),
    log('resto',  45.7640, 4.8357),
    log('boulot', 43.2965, 5.3698),
  ];
  const v = PM.fitView(points, width, height);
  const TILE = 256;
  const cx = PM.lonToTileX(v.lon, v.zoom) * TILE;
  const cy = PM.latToTileY(v.lat, v.zoom) * TILE;
  for (const p of points) {
    const px = PM.lonToTileX(p.lon, v.zoom) * TILE - (cx - width / 2);
    const py = PM.latToTileY(p.lat, v.zoom) * TILE - (cy - height / 2);
    assert.ok(px >= padding - 1 && px <= width - padding + 1,  `x hors cadre : ${px}`);
    assert.ok(py >= padding - 1 && py <= height - padding + 1, `y hors cadre : ${py}`);
  }
});

test('fitView zoome davantage quand les points sont proches', () => {
  const proches = PM.fitView([log('a', 48.8566, 2.3522), log('b', 48.8580, 2.3540)], 320, 260);
  const loin    = PM.fitView([log('a', 48.8566, 2.3522), log('b', 43.2965, 5.3698)], 320, 260);
  assert.ok(proches.zoom > loin.zoom, `${proches.zoom} devrait dépasser ${loin.zoom}`);
});

// ---------- Effacement ----------

test('forgetAllPositions retire les coordonnées mais garde les lieux', () => {
  const logs = [log('maison', 48.8566, 2.3522), log('boulot', 48.87, 2.33), log('resto')];
  const n = PM.forgetAllPositions(logs);
  assert.strictEqual(n, 2);
  assert.strictEqual(logs.every(l => !('lat' in l) && !('lon' in l)), true);
  assert.strictEqual(logs.map(l => l.place).join('|'), 'maison|boulot|resto');
  assert.ok(logs[0].updated_at > 0, 'updated_at doit avancer pour que le cloud reprenne la version vidée');
});
