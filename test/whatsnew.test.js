// Popup « Quoi de neuf » : comparaison de versions et sélection des entrées.
//
// L'enjeu : ne rien montrer au tout premier lancement (l'onboarding s'en charge),
// montrer TOUTES les versions sautées quand quelqu'un revient après plusieurs
// mises à jour, et ne rien montrer si rien n'a changé.

const test = require('node:test');
const assert = require('node:assert');
const { loadInto, readGlobals } = require('./helpers/load');

const ctx = loadInto('js/app/app-whatsnew.js', { $id: () => null, esc: s => String(s) });
const { compareVersions, changelogSince } = ctx;
// APP_VERSION et APP_CHANGELOG sont des `const` : ils vivent dans la portée
// lexicale du script, pas sur l'objet global.
const { APP_VERSION, APP_CHANGELOG } = readGlobals(ctx, ['APP_VERSION', 'APP_CHANGELOG']);

test('compareVersions — ordre correct', () => {
  assert.ok(compareVersions('2.13.0', '2.12.0') > 0);
  assert.ok(compareVersions('2.12.0', '2.13.0') < 0);
  assert.strictEqual(compareVersions('2.12.0', '2.12.0'), 0);
});

test('compareVersions — compare nombre à nombre, pas texte à texte', () => {
  // En comparaison de chaînes, "2.9.0" > "2.10.0" : le piège classique.
  assert.ok(compareVersions('2.10.0', '2.9.0') > 0);
  assert.ok(compareVersions('2.2.0', '2.11.0') < 0);
});

test('compareVersions — segments manquants traités comme 0', () => {
  assert.strictEqual(compareVersions('2.13', '2.13.0'), 0);
  assert.ok(compareVersions('3', '2.99.99') > 0);
});

test('changelogSince — rien vu encore : aucune entrée (l\'onboarding prend la main)', () => {
  // longueur plutôt que deepStrictEqual : le tableau vient du contexte vm et
  // n'a donc pas le même Array.prototype que ce fichier de test
  assert.strictEqual(changelogSince(null).length, 0);
  assert.strictEqual(changelogSince(undefined).length, 0);
  assert.strictEqual(changelogSince('').length, 0);
});

test('changelogSince — déjà à jour : aucune entrée', () => {
  assert.strictEqual(changelogSince(APP_VERSION).length, 0);
});

test('changelogSince — plusieurs versions sautées : toutes remontent', () => {
  const e = changelogSince('2.11.0');
  assert.ok(e.length >= 2, `attendu au moins 2 entrées, reçu ${e.length}`);
  assert.ok(e.every(x => compareVersions(x.version, '2.11.0') > 0));
  assert.ok(!e.some(x => x.version === '2.11.0'), 'la version déjà vue ne doit pas réapparaître');
});

test('changelogSince — une seule version de retard', () => {
  const e = changelogSince('2.12.0');
  assert.strictEqual(e.length, 1);
  assert.strictEqual(e[0].version, APP_VERSION);
});

test('changelogSince — le plus récent en premier', () => {
  const e = changelogSince('2.11.0');
  for (let i = 1; i < e.length; i++) {
    assert.ok(compareVersions(e[i - 1].version, e[i].version) > 0, 'ordre décroissant attendu');
  }
});

test('le changelog décrit bien la version courante', () => {
  assert.strictEqual(APP_CHANGELOG[0].version, APP_VERSION,
    'la première entrée doit correspondre à APP_VERSION — sinon la popup annonce une version qui n\'existe pas');
  assert.ok(APP_CHANGELOG[0].items.length > 0);
  for (const e of APP_CHANGELOG) {
    assert.match(e.version, /^\d+\.\d+\.\d+$/);
    assert.ok(e.items.every(i => Array.isArray(i) && i.length === 2));
  }
});
