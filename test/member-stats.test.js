// Fiche membre et partage de stats (v2.22.0).
//
// buildMemberCard agrège ce que les copines voient d'une membre (total,
// série, records, répartition textures/couleurs) : une erreur afficherait un
// chiffre faux devant tout le groupe. statsShareText fabrique le résumé publié
// dans le feed, avec un ref stable par mois (rejouable sans doublon).

const test = require('node:test');
const assert = require('node:assert');
const { loadInto } = require('./helpers/load');

const F = loadInto('js/social-fun.js').SocialFun;

const at = (y, m, d, h = 12) => new Date(y, m, d, h).getTime();

test('buildMemberCard : comptage, textures triées et pourcentages', () => {
  const card = F.buildMemberCard(
    { id: 'a', username: 'Léa', avatar: '💩' },
    [
      { date: at(2026, 8, 17, 9),  texture: 'normal', color: 'marron', mood: '😊' },
      { date: at(2026, 8, 17, 18), texture: 'dur',    color: 'marron', mood: '' },
      { date: at(2026, 8, 16, 9),  texture: 'normal', color: 'vert',   mood: '😊' },
    ],
    {}, 0,
    at(2026, 8, 17, 20),
  );
  assert.strictEqual(card.total, 3);
  assert.strictEqual(card.textures.map(t => t.id).join('|'), 'normal|dur');
  assert.strictEqual(card.textures[0].count, 2);
  assert.strictEqual(card.textures[0].pct, 67);
  assert.strictEqual(card.colors[0].id, 'marron');
  assert.strictEqual(card.colors[0].count, 2);
  assert.strictEqual(card.topMood[0], '😊');
  assert.strictEqual(card.topMood[1], 2);
  assert.strictEqual(card.bestDay, 2);
  assert.strictEqual(card.bestMonth, 3);
});

test('buildMemberCard : série = jours d\'affilée jusqu\'à aujourd\'hui', () => {
  const card = F.buildMemberCard(
    { id: 'a' },
    [
      { date: at(2026, 8, 17), texture: 'normal', color: 'marron', mood: '' },
      { date: at(2026, 8, 16), texture: 'normal', color: 'marron', mood: '' },
      { date: at(2026, 8, 15), texture: 'normal', color: 'marron', mood: '' },
      { date: at(2026, 8, 13), texture: 'normal', color: 'marron', mood: '' }, // trou le 14
    ],
    {}, 0,
    at(2026, 8, 17, 20),
  );
  assert.strictEqual(card.streak, 3);
});

test('buildMemberCard : pas de caca aujourd\'hui -> série 0', () => {
  const card = F.buildMemberCard(
    { id: 'a' },
    [{ date: at(2026, 8, 16), texture: 'normal', color: 'marron', mood: '' }],
    {}, 0,
    at(2026, 8, 17, 20),
  );
  assert.strictEqual(card.streak, 0);
});

test('buildMemberCard : stats du groupe, trophées et liste vide', () => {
  const card = F.buildMemberCard(
    { id: 'a' }, [], { month: 7, week7: 5 }, 3, at(2026, 8, 17, 20),
  );
  assert.strictEqual(card.month, 7);
  assert.strictEqual(card.week7, 5);
  assert.strictEqual(card.trophies, 3);
  assert.strictEqual(card.total, 0);
  assert.strictEqual(card.avg30, 0);
  assert.strictEqual(card.textures.length, 0);
  assert.strictEqual(card.firstPoop, null);
});

test('buildMemberCard : seule dans son groupe, le total vient des stats', () => {
  const card = F.buildMemberCard(
    { id: 'a' }, [], { total: 42, month: 7 }, 0, at(2026, 8, 17, 20),
  );
  assert.strictEqual(card.total, 42);
  assert.strictEqual(card.month, 7);
  assert.strictEqual(card.textures.length, 0);
});

test('buildMemberCard : une texture ou couleur inconnue ne casse rien', () => {
  const card = F.buildMemberCard(
    { id: 'a' },
    [{ date: at(2026, 8, 17), texture: 'alien', color: 'violet', mood: '' }],
    {}, 0,
    at(2026, 8, 17, 20),
  );
  assert.strictEqual(card.total, 1);
  assert.strictEqual(card.textures[0].id, 'alien');
  assert.strictEqual(card.colors[0].id, 'violet');
});

test('statsShareText : résumé stable par mois et ref déterministe', () => {
  const s = F.statsShareText({ month: 12, streak: 5, topMood: ['😊', 3] }, at(2026, 8, 17, 20));
  assert.strictEqual(s.ref, 'month_2026_9');
  assert.strictEqual(s.emoji, '📊');
  assert.match(s.title, /12 cacas ce mois/);
  assert.match(s.title, /🔥 5 j de série/);
  assert.match(s.title, /humeur 😊/);
});
