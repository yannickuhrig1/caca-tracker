// Structure d'index.html : les identifiants doivent être uniques.
//
// L'enjeu : tout le JS de l'app passe par getElementById. Deux éléments qui
// portent le même id, et le navigateur n'en rend que le premier — le second
// devient un bouton mort, tandis que le premier hérite d'un gestionnaire de
// clic qui ne lui était pas destiné. Rien ne plante, rien ne s'affiche dans la
// console : c'est exactement ce qui est arrivé en v2.22.0 avec
// `share-stats-btn`, porté à la fois par « 📤 Partager en image » (accueil) et
// par « 📤 Partager mes stats » (podium).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('aucun identifiant en double dans index.html', () => {
  const vus = new Map();
  const doublons = [];

  for (const m of html.matchAll(/\bid="([^"]+)"/g)) {
    const id = m[1];
    const ligne = html.slice(0, m.index).split('\n').length;
    if (vus.has(id)) doublons.push(`${id} (lignes ${vus.get(id)} et ${ligne})`);
    else vus.set(id, ligne);
  }

  assert.deepStrictEqual(doublons, [],
    'identifiants en double : getElementById n\'en verra que le premier');
});

test('les deux boutons de partage ont des identifiants distincts', () => {
  // Deux actions différentes, donc deux id : l'un ouvre le choix de partage en
  // image (app-core.js), l'autre publie un résumé dans le feed (social.js).
  assert.ok(html.includes('id="share-stats-btn"'),
    'le bouton « Partager en image » de l\'accueil a disparu');
  assert.ok(html.includes('id="share-stats-feed-btn"'),
    'le bouton « Partager mes stats » du podium a disparu');
});

test('les toggles de partage du profil ne sont pas masqués par le CSS', () => {
  // En v2.22.0, la règle `.pf-group:not(:has(.pf-item:not(.hidden)))` masquait
  // le groupe des toggles « Partager ma position » / « Stats détaillées »
  // (ils utilisent .pf-row, pas .pf-item) : impossible d'activer le partage.
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'styles.css'), 'utf8');
  assert.ok(html.includes('id="geo-share-toggle"') && html.includes('id="stats-share-toggle"'),
    'les toggles de partage du profil ont disparu');
  assert.ok(css.includes('.pf-group:not(:has(.pf-item:not(.hidden))):not(:has(.pf-row))'),
    'la règle .pf-group doit tolérer les groupes contenant .pf-row (toggles de partage)');
});
