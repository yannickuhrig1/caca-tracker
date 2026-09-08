// Recherche et filtres de l'historique (v2.15.0).
//
// `filterLogs` décide de ce que l'utilisatrice voit dans l'onglet Historique.
// Une erreur ici masque silencieusement des entrées : rien ne signale qu'un
// caca existe mais n'est pas affiché.

const test = require('node:test');
const assert = require('node:assert');
const { loadInto, daysAgo } = require('./helpers/load');

const PLACES = [
  { id: 'maison', emoji: '🏠', label: 'Maison' },
  { id: 'resto',  emoji: '🍽️', label: 'Resto' },
];

function charger() {
  return loadInto('js/app/app-render.js', {
    state: { logs: [] },
    $id: () => null,
    $debug: () => {},
    esc: s => String(s),
    textureEmoji: () => '',
    renderDashboard: () => {},
    updateBadges: () => {},
    updateChart: () => {},
    PoopMapModule: { placeMeta: id => PLACES.find(p => p.id === id) || null },
  });
}

const ctx = charger();
const { filterLogs, historyFiltersActive, yearlyTotals } = ctx;

const vide = { q: '', texture: '', color: '', place: '', period: 'all' };
const log = (o = {}) => ({ date: daysAgo(1), texture: 'normal', color: 'marron', ...o });

// ---------- Filtres ----------

test('sans filtre, tout ressort', () => {
  const logs = [log(), log(), log()];
  assert.strictEqual(filterLogs(logs, vide).length, 3);
});

test('filtre par texture, couleur et lieu', () => {
  const logs = [
    log({ texture: 'dur',    color: 'vert',   place: 'maison' }),
    log({ texture: 'normal', color: 'vert',   place: 'resto'  }),
    log({ texture: 'dur',    color: 'marron', place: 'maison' }),
  ];
  assert.strictEqual(filterLogs(logs, { ...vide, texture: 'dur' }).length, 2);
  assert.strictEqual(filterLogs(logs, { ...vide, color: 'vert' }).length, 2);
  assert.strictEqual(filterLogs(logs, { ...vide, place: 'maison' }).length, 2);
  assert.strictEqual(filterLogs(logs, { ...vide, texture: 'dur', color: 'vert' }).length, 1);
});

test('filtrer sur un lieu ne remonte pas les entrées sans lieu', () => {
  const logs = [log({ place: 'maison' }), log(), log({ place: null })];
  assert.strictEqual(filterLogs(logs, { ...vide, place: 'maison' }).length, 1);
});

test('la période coupe bien les entrées trop anciennes', () => {
  const logs = [log({ date: daysAgo(2) }), log({ date: daysAgo(10) }), log({ date: daysAgo(200) })];
  assert.strictEqual(filterLogs(logs, { ...vide, period: '7'  }).length, 1);
  assert.strictEqual(filterLogs(logs, { ...vide, period: '30' }).length, 2);
  assert.strictEqual(filterLogs(logs, { ...vide, period: 'all' }).length, 3);
});

test('« cette année » part du 1er janvier, pas de 365 jours en arrière', () => {
  const now = new Date(2026, 5, 15).getTime();          // 15 juin 2026
  const logs = [
    log({ date: new Date(2026, 0, 2).getTime() }),      // 2 janvier 2026 : dedans
    log({ date: new Date(2025, 11, 30).getTime() }),    // 30 décembre 2025 : dehors
  ];
  assert.strictEqual(filterLogs(logs, { ...vide, period: 'year' }, now).length, 1);
});

// ---------- Recherche ----------

test('la recherche porte sur la note, le lieu et la texture', () => {
  const logs = [
    log({ comment: 'Record perso !' }),
    log({ place: 'resto' }),
    log({ texture: 'explosif' }),
  ];
  assert.strictEqual(filterLogs(logs, { ...vide, q: 'record' }).length, 1);
  assert.strictEqual(filterLogs(logs, { ...vide, q: 'resto' }).length, 1);
  assert.strictEqual(filterLogs(logs, { ...vide, q: 'explo' }).length, 1);
});

test('la recherche ignore la casse et les espaces autour', () => {
  const logs = [log({ comment: 'Record Perso' })];
  assert.strictEqual(filterLogs(logs, { ...vide, q: '  RECORD  ' }).length, 1);
});

test('la date est cherchable en toutes lettres', () => {
  const logs = [log({ date: new Date(2026, 0, 5, 12).getTime() })];   // lundi 5 janvier 2026
  assert.strictEqual(filterLogs(logs, { ...vide, q: 'janvier' }).length, 1);
  assert.strictEqual(filterLogs(logs, { ...vide, q: '2026' }).length, 1);
  assert.strictEqual(filterLogs(logs, { ...vide, q: 'décembre' }).length, 0);
});

test('recherche et filtres se cumulent', () => {
  const logs = [
    log({ texture: 'dur', comment: 'aïe' }),
    log({ texture: 'mou', comment: 'aïe' }),
  ];
  assert.strictEqual(filterLogs(logs, { ...vide, q: 'aïe', texture: 'dur' }).length, 1);
});

test('une liste absente ne fait pas planter la recherche', () => {
  assert.strictEqual(filterLogs(undefined, vide).length, 0);
});

// ---------- État des filtres ----------

test('historyFiltersActive distingue le formulaire vierge des filtres posés', () => {
  assert.strictEqual(historyFiltersActive(vide), false);
  assert.strictEqual(historyFiltersActive({ ...vide, q: '   ' }), false);
  assert.strictEqual(historyFiltersActive({ ...vide, q: 'a' }), true);
  assert.strictEqual(historyFiltersActive({ ...vide, place: 'maison' }), true);
  assert.strictEqual(historyFiltersActive({ ...vide, period: '7' }), true);
});

// ---------- Totaux par année ----------

test('yearlyTotals regroupe par année, de la plus récente à la plus ancienne', () => {
  const logs = [
    log({ date: new Date(2026, 0, 3).getTime() }),
    log({ date: new Date(2026, 0, 4).getTime() }),
    log({ date: new Date(2025, 5, 4).getTime() }),
  ];
  const a = yearlyTotals(logs, new Date(2026, 5, 15).getTime());
  assert.strictEqual(a.map(x => x.year).join('|'), '2026|2025');
  assert.strictEqual(a[0].total, 2);
  assert.strictEqual(a[1].total, 1);
});

test('l\'année en cours est ramenée aux jours écoulés, pas à 365', () => {
  const now = new Date(2026, 0, 10).getTime();          // 10 jours écoulés
  const logs = Array.from({ length: 10 }, (_, i) => log({ date: new Date(2026, 0, i + 1).getTime() }));
  const [a] = yearlyTotals(logs, now);
  assert.strictEqual(a.enCours, true);
  assert.ok(a.parJour > 0.9, `attendu ~1/jour, obtenu ${a.parJour}`);
});

test('une année révolue est divisée par 365 (366 si bissextile)', () => {
  const logs = [log({ date: new Date(2025, 3, 1).getTime() })];
  const [a] = yearlyTotals(logs, new Date(2026, 5, 15).getTime());
  assert.strictEqual(a.enCours, false);
  assert.ok(Math.abs(a.parJour - 1 / 365) < 1e-9, `obtenu ${a.parJour}`);
});

test('les jours actifs comptent les jours distincts, pas les cacas', () => {
  const j = new Date(2025, 3, 1).getTime();
  const [a] = yearlyTotals([log({ date: j }), log({ date: j }), log({ date: j + 86400000 })],
                           new Date(2026, 5, 15).getTime());
  assert.strictEqual(a.total, 3);
  assert.strictEqual(a.joursActifs, 2);
});

test('le meilleur mois est bien le plus fourni', () => {
  const logs = [
    log({ date: new Date(2025, 2, 1).getTime() }),
    log({ date: new Date(2025, 2, 2).getTime() }),
    log({ date: new Date(2025, 7, 1).getTime() }),
  ];
  const [a] = yearlyTotals(logs, new Date(2026, 5, 15).getTime());
  assert.strictEqual(a.meilleurMois, 2);      // mars
  assert.strictEqual(a.meilleurMoisTotal, 2);
});

test('aucune entrée -> aucune année', () => {
  assert.strictEqual(yearlyTotals([]).length, 0);
});
