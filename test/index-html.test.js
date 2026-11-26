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

test('présence des identifiants structurels v3.0 dans index.html', () => {
  const requisV3 = [
    'dock-poop-btn',
    'saisie-pane-express',
    'saisie-pane-sante',
    'moi-header-bar',
    'stats-poles-bar',
    'guide-modal',
    'wardrobe-container',
    'social-live-throne',
    'social-pane-spots'
  ];
  for (const id of requisV3) {
    assert.ok(html.includes(`id="${id}"`), `l'élément #${id} est requis en v3.0`);
  }
});

test('unicité de .moi-subtabs dans index.html', () => {
  const occurrences = html.match(/class="[^"]*\bmoi-subtabs\b[^"]*"/g) || [];
  assert.strictEqual(occurrences.length, 1,
    `une seule barre .moi-subtabs partagée est attendue (trouvé ${occurrences.length})`);
});

test('absence de 72vh sur #history-list', () => {
  const balise = html.match(/<[^>]*\bid="history-list"[^>]*>/);
  assert.ok(balise, '#history-list doit être présent dans index.html');
  assert.ok(!balise[0].includes('72vh') && !html.includes('72vh'),
    '#history-list ne doit plus utiliser de hauteur bornée à 72vh');
});

test('absence du sélecteur fautif #drawer > div dans css/app.css', () => {
  const appCss = fs.readFileSync(path.join(__dirname, '..', 'css', 'app.css'), 'utf8');
  assert.ok(!/#drawer\s*>\s*div\b/.test(appCss),
    'le sélecteur fautif #drawer > div ne doit plus figurer dans css/app.css');
});

test('cohérence sw.js : chaque script local js/... de index.html est dans ASSETS', () => {
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  const blocAssets = sw.match(/const ASSETS = \[([\s\S]*?)\];/);
  assert.ok(blocAssets, 'déclaration const ASSETS = [...] introuvable dans sw.js');
  const assets = new Set([...blocAssets[1].matchAll(/'([^']+)'/g)].map(m => m[1]));
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="(js\/[^"]+)"/g)].map(m => m[1]);
  assert.ok(scripts.length > 0, 'aucun script local js/... détecté dans index.html');
  const manquants = scripts.filter(src => !assets.has(`./${src}`));
  assert.deepStrictEqual(manquants, [],
    'chaque script local js/... de index.html doit être pré-caché dans ASSETS de sw.js');
});

test('absence de #poop-btn dans index.html', () => {
  assert.ok(!/\bid="poop-btn"/.test(html),
    '#poop-btn ne doit plus exister dans index.html (doublon avec #sidebar-poop-btn / #dock-poop-btn)');
});

test('#geo-btn est présent dans #saisie-pane-express sans classe hidden', () => {
  const debut = html.indexOf('id="saisie-pane-express"');
  const fin = html.indexOf('id="saisie-pane-sante"');
  assert.ok(debut !== -1 && fin !== -1 && debut < fin,
    '#saisie-pane-express doit précéder #saisie-pane-sante');
  const paneExpress = html.slice(debut, fin);
  const baliseGeo = paneExpress.match(/<button\b[^>]*\bid="geo-btn"[^>]*>/);
  assert.ok(baliseGeo, '#geo-btn doit être présent dans #saisie-pane-express');
  const classMatch = baliseGeo[0].match(/\bclass="([^"]*)"/);
  const classes = classMatch ? classMatch[1].split(/\s+/) : [];
  assert.ok(!classes.includes('hidden'),
    '#geo-btn ne doit pas avoir la classe hidden par défaut');
});

test('présence des boutons carte #home-map-btn et #open-group-map-btn', () => {
  assert.ok(/\bid="home-map-btn"/.test(html),
    '#home-map-btn doit être présent dans index.html');
  const matchGroupMapBtn = html.match(/<button\b[^>]*\bid="open-group-map-btn"[^>]*>([\s\S]*?)<\/button>/);
  assert.ok(matchGroupMapBtn, '#open-group-map-btn doit être présent dans index.html');
  assert.match(matchGroupMapBtn[1], /Carte du groupe/,
    '#open-group-map-btn doit contenir le texte "Carte du groupe"');
});
