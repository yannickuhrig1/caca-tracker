// Export CSV (v2.15.0).
//
// Le fichier part chez l'utilisatrice et s'ouvre dans un tableur : un point-
// virgule ou un guillemet mal échappé décale silencieusement des colonnes.

const test = require('node:test');
const assert = require('node:assert');
const { loadInto, readGlobals } = require('./helpers/load');

const ctx = loadInto('js/app/app-sync.js', {
  state: { logs: [] },
  $id: () => null,
  $debug: () => {},
  renderAll: () => {},
  saveState: () => {},
  PoopMapModule: { placeMeta: id => (id === 'maison' ? { label: 'Maison' } : null) },
});
const { toCSV } = readGlobals(ctx, ['toCSV']);

const lignes = csv => csv.split('\n');
const log = (o = {}) => ({ date: new Date(2026, 0, 5, 9, 30).getTime(), texture: 'normal', color: 'marron', ...o });

test('en-tête présent et une ligne par caca', () => {
  const csv = toCSV([log(), log(), log()]);
  assert.strictEqual(lignes(csv).length, 4);
  assert.ok(lignes(csv)[0].startsWith('date_iso;date;heure;'));
});

test('les entrées sortent de la plus récente à la plus ancienne', () => {
  const csv = toCSV([
    log({ date: new Date(2026, 0, 1).getTime(), comment: 'vieux' }),
    log({ date: new Date(2026, 0, 9).getTime(), comment: 'récent' }),
  ]);
  assert.ok(lignes(csv)[1].includes('récent'));
  assert.ok(lignes(csv)[2].includes('vieux'));
});

test('une note contenant un point-virgule est mise entre guillemets', () => {
  const csv = toCSV([log({ comment: 'gros ; costaud' })]);
  assert.ok(lignes(csv)[1].includes('"gros ; costaud"'), lignes(csv)[1]);
  assert.strictEqual(lignes(csv)[1].split(';').length > 11, true);  // le champ protégé ne casse pas la ligne
});

test('les guillemets d\'une note sont doublés, pas supprimés', () => {
  const csv = toCSV([log({ comment: 'le "gros" caca' })]);
  assert.ok(lignes(csv)[1].includes('"le ""gros"" caca"'), lignes(csv)[1]);
});

test('une note sur plusieurs lignes ne casse pas le fichier', () => {
  const csv = toCSV([log({ comment: 'ligne 1\nligne 2' })]);
  // 1 en-tête + 1 entrée dont la note contient un saut de ligne protégé
  assert.strictEqual(csv.split('\n').length, 3);
  assert.ok(csv.includes('"ligne 1\nligne 2"'));
});

test('lieu, position et retard sont exportés en clair', () => {
  const csv = toCSV([log({ place: 'maison', lat: 48.8566, lon: 2.3522, isRetro: true })]);
  const l = lignes(csv)[1];
  assert.ok(l.includes('Maison'), l);
  assert.ok(l.includes('48.8566;2.3522'), l);
  assert.ok(l.includes(';oui;'), l);
});

test('une entrée sans position laisse les colonnes vides, pas « undefined »', () => {
  const l = lignes(toCSV([log()]))[1];
  assert.strictEqual(l.includes('undefined'), false, l);
  assert.strictEqual(l.includes('null'), false, l);
  assert.ok(l.endsWith(';non;;;'), l);   // pas de retard, ni durée, ni santé, ni note
});

test('liste vide : seulement l\'en-tête', () => {
  assert.strictEqual(lignes(toCSV([])).length, 1);
  assert.strictEqual(lignes(toCSV(undefined)).length, 1);
});

test('toutes les lignes ont le même nombre de colonnes', () => {
  const csv = toCSV([log(), log({ comment: 'avec ; et "guillemets"' }), log({ place: 'maison' })]);
  // Comptage naïf impossible avec des champs protégés : on parse pour de vrai.
  const colonnes = ligne => {
    let n = 1, dansGuillemets = false;
    for (let i = 0; i < ligne.length; i++) {
      const c = ligne[i];
      if (c === '"') dansGuillemets = !dansGuillemets;
      else if (c === ';' && !dansGuillemets) n++;
    }
    return n;
  };
  const compte = lignes(csv).map(colonnes);
  assert.strictEqual(new Set(compte).size, 1, 'colonnes par ligne : ' + compte.join(', '));
  assert.strictEqual(compte[0], 13);
});

test('durée et carnet de santé sont exportés (v2.18.0)', () => {
  const l = lignes(toCSV([log({ duration: 195, health: ['cafe', 'stress'], comment: 'ok' })]))[1];
  assert.ok(l.includes(';non;195;cafe, stress;ok'), l);
});
