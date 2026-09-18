// Photos de profil (v2.21.0) : 50 emojis fixes, 12 animés débloqués par badge.
//
// L'avatar reste un simple emoji en base : c'est l'emoji lui-même qui dit
// s'il est animé. Il faut donc qu'aucun animé ne figure parmi les fixes,
// sinon une copine qui choisit l'emoji fixe s'animerait sans rien débloquer.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadInto, readGlobals } = require('./helpers/load');

const ctx = loadInto(['js/app/app-badges.js', 'js/app/app-avatars.js'], { $id: () => null });
const { AVATARS_FIXES, AVATARS_ANIMES, BADGE_DEFS } = readGlobals(ctx, ['AVATARS_FIXES', 'AVATARS_ANIMES', 'BADGE_DEFS']);
const { avatarAnime, avatarHTML, avatarsAnimesEtat } = ctx;

test('50 avatars fixes, sans doublon', () => {
  assert.strictEqual(AVATARS_FIXES.length, 50);
  assert.strictEqual(new Set(AVATARS_FIXES).size, 50);
});

test('12 avatars animés, distincts entre eux et absents des fixes', () => {
  assert.strictEqual(AVATARS_ANIMES.length, 12);
  const avs = AVATARS_ANIMES.map(a => a.av);
  assert.strictEqual(new Set(avs).size, 12);
  avs.forEach(av => assert.ok(!AVATARS_FIXES.includes(av), `${av} est aussi un avatar fixe`));
});

test('chaque avatar animé pointe vers un badge qui existe', () => {
  const ids = new Set(BADGE_DEFS.map(b => b.id));
  AVATARS_ANIMES.forEach(a => assert.ok(ids.has(a.badge), `badge inconnu : ${a.badge}`));
  assert.strictEqual(new Set(AVATARS_ANIMES.map(a => a.badge)).size, 12, 'un badge par avatar');
});

test('chaque animation a sa classe CSS et son @keyframes', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'styles.css'), 'utf8');
  new Set(AVATARS_ANIMES.map(a => a.anim)).forEach(anim => {
    const m = css.match(new RegExp(`\\.av-anim-${anim}\\s*\\{[^}]*animation:\\s*(\\w+)`));
    assert.ok(m, `classe .av-anim-${anim} absente`);
    assert.ok(css.includes(`@keyframes ${m[1]}`), `@keyframes ${m[1]} absent`);
  });
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.av-anim \{ animation: none/);
});

test('avatarHTML : animé si débloquable, texte échappé sinon', () => {
  assert.strictEqual(avatarHTML('🐻'), '🐻');
  assert.strictEqual(avatarHTML(null), '💩');
  assert.strictEqual(avatarHTML('', '👤'), '👤');
  assert.strictEqual(avatarHTML('<b>'), '&lt;b&gt;');
  assert.strictEqual(avatarHTML('🚀'), '<span class="av-anim av-anim-decolle">🚀</span>');
  assert.strictEqual(avatarAnime('🐻'), null);
});

test('avatarsAnimesEtat : débloqué seulement si le badge est gagné', () => {
  const etats = { fridayFun: { done: true, pct: 100 }, streak7: { done: false, pct: 42.6 } };
  const res = avatarsAnimesEtat(etats, BADGE_DEFS);
  const danse = res.find(r => r.badge === 'fridayFun');
  const flamme = res.find(r => r.badge === 'streak7');
  assert.strictEqual(danse.debloque, true);
  assert.strictEqual(danse.badgeLabel, 'TGIF');
  assert.strictEqual(flamme.debloque, false);
  assert.strictEqual(flamme.pct, 43);
  assert.strictEqual(res.filter(r => r.debloque).length, 1);
  assert.strictEqual(avatarsAnimesEtat({}, BADGE_DEFS).filter(r => r.debloque).length, 0);
});
