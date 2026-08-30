// ============================================================
//  Chargeur de sources pour les tests
//
//  L'app est faite de scripts classiques qui posent des fonctions dans la
//  portée globale du navigateur — il n'y a ni export ni bundler. Plutôt que
//  d'imposer une réécriture en modules ES juste pour tester, on évalue les
//  fichiers dans un contexte `node:vm` muni de stubs minimalistes, puis on
//  récupère les fonctions depuis ce contexte.
//
//  Conséquence : les tests portent sur le CODE RÉELLEMENT LIVRÉ, pas sur une
//  copie adaptée qui pourrait diverger.
// ============================================================

const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

/** Stubs juste suffisants pour que les fichiers s'évaluent sans DOM. */
function makeContext(extra = {}) {
  const noop = () => {};
  const store = new Map();

  const ctx = {
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    },
    navigator: { onLine: true },
    location: { origin: 'http://localhost', pathname: '/', search: '' },
    document: {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: noop,
      createElement: () => ({ style: {}, classList: { add: noop, remove: noop } }),
      documentElement: { setAttribute: noop, getAttribute: () => null },
      body: { style: {} },
    },
    ...extra,
  };

  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.window.addEventListener = noop;
  ctx.addEventListener = noop;

  vm.createContext(ctx);
  return ctx;
}

/**
 * Évalue un ou plusieurs fichiers du dépôt dans un même contexte partagé
 * (comme le fait le navigateur) et renvoie ce contexte.
 */
function loadInto(files, extra = {}) {
  const ctx = makeContext(extra);
  for (const rel of [].concat(files)) {
    const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    vm.runInContext(code, ctx, { filename: rel });
  }
  return ctx;
}

/** Horodatage de `n` jours avant aujourd'hui, à l'heure indiquée. */
function daysAgo(n, hour = 12) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

module.exports = { loadInto, daysAgo, ROOT };
