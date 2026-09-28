// Cohérence de la version entre les fichiers qui la portent.
//
// La v2.22.0 a raté trois synchronisations d'un coup, chacune silencieuse :
//   - package.json passait à 2.22.0 sans qu'APP_VERSION bouge, donc pas de
//     popup « Quoi de neuf » (couvert par whatsnew.test.js) ;
//   - manifest.json restait à la version d'avant ;
//   - une résolution de conflit laissait DEUX clés "version" dans
//     package.json — c'est du JSON valide, la dernière gagne, et ni
//     JSON.parse ni les tests ne s'en plaignaient.
//
// D'où ce fichier : il compare les fichiers entre eux plutôt que chacun avec
// lui-même, seule façon de voir ce genre de dérive.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const racine = path.join(__dirname, '..');
const lire = f => fs.readFileSync(path.join(racine, f), 'utf8');

/** Clés de premier niveau d'un objet JSON, doublons compris. */
function clesRacine(source) {
  const cles = [];
  let profondeur = 0;
  for (const ligne of source.split('\n')) {
    const m = ligne.match(/^\s*"([^"]+)"\s*:/);
    if (m && profondeur === 1) cles.push(m[1]);
    for (const c of ligne) {
      if (c === '{' || c === '[') profondeur++;
      else if (c === '}' || c === ']') profondeur--;
    }
  }
  return cles;
}

for (const f of ['package.json', 'manifest.json']) {
  test(`${f} — aucune clé de premier niveau en double`, () => {
    const cles = clesRacine(lire(f));
    const doublons = cles.filter((c, i) => cles.indexOf(c) !== i);
    assert.deepStrictEqual([...new Set(doublons)], [],
      'JSON accepte les clés en double et garde la dernière : la dérive passe inaperçue');
  });
}

test('package.json et manifest.json annoncent la même version', () => {
  assert.strictEqual(
    JSON.parse(lire('manifest.json')).version,
    JSON.parse(lire('package.json')).version);
});

test('le CHANGELOG a une entrée pour la version courante', () => {
  const v = JSON.parse(lire('package.json')).version;
  assert.ok(lire('CHANGELOG.md').includes(`## [${v}]`),
    `aucune section « ## [${v}] » dans CHANGELOG.md`);
});

test('sw.js déclare un seul cache, au bon format', () => {
  const caches = [...lire('sw.js').matchAll(/^const CACHE = '([^']+)';$/gm)];
  assert.strictEqual(caches.length, 1, 'une seule déclaration de CACHE attendue');
  assert.match(caches[0][1], /^caca-v\d+$/);
});
