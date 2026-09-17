// Contraste des 16 thèmes (v2.18.0).
//
// Galaxy et Neon ont déjà eu du texte illisible (v2.6.0) : le souci ne se voit
// qu'en ouvrant le thème concerné. Ce test lit les variables de css/app.css et
// calcule le contraste WCAG du texte sur une carte, au pire endroit du dégradé
// de fond (la carte est semi-transparente).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./helpers/load');

const css = fs.readFileSync(path.join(ROOT, 'css', 'app.css'), 'utf8');

/** { theme: { variable: valeur } }, :root faisant office de thème « default ». */
function themes() {
  const blocs = {};
  const re = /(:root|\[data-theme="([\w-]+)"\])\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const vars = {};
    m[3].replace(/--([\w-]+)\s*:\s*([^;]+);/g, (_, k, v) => { vars[k] = v.trim(); });
    if (!vars['text-primary'] && !vars['card-bg'] && !vars['bg-via']) continue;
    const nom = m[2] || 'default';
    blocs[nom] = { ...(blocs[nom] || {}), ...vars };
  }
  return blocs;
}

function couleur(c) {
  let r;
  if ((r = /^#([0-9a-f]{3})$/i.exec(c))) return [...r[1]].map(x => parseInt(x + x, 16)).concat(1);
  if ((r = /^#([0-9a-f]{6})$/i.exec(c))) return [0, 2, 4].map(i => parseInt(r[1].slice(i, i + 2), 16)).concat(1);
  if ((r = /^rgba?\(([^)]+)\)$/i.exec(c))) { const p = r[1].split(',').map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
  return null;
}

const luminance = ([r, g, b]) => {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contraste = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const surFond = (avant, fond) => [0, 1, 2].map(i => avant[i] * avant[3] + fond[i] * (1 - avant[3])).concat(1);

const T = themes();
const base = T.default;

test('les 16 thèmes sont trouvés', () => {
  assert.strictEqual(Object.keys(T).length, 16, Object.keys(T).join(', '));
});

for (const [nom, vars] of Object.entries(T)) {
  test(`thème ${nom} : texte lisible sur une carte (WCAG AA, 4.5:1)`, () => {
    const v = { ...base, ...vars };
    const carte = couleur(v['card-bg']);
    const fonds = ['bg-from', 'bg-via', 'bg-to'].map(k => couleur(v[k])).filter(Boolean);
    assert.ok(carte && fonds.length, `variables illisibles pour ${nom}`);
    const cartes = fonds.map(f => surFond(carte, f));
    ['text-primary', 'text-secondary'].forEach(k => {
      const c = couleur(v[k]);
      assert.ok(c, `${k} absent pour ${nom}`);
      const pire = Math.min(...cartes.map(fond => contraste(c, fond)));
      assert.ok(pire >= 4.5, `${nom} / ${k} : ${pire.toFixed(2)}:1`);
    });
  });
}
