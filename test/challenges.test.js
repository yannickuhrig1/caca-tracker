// Défis hebdomadaires : rotation du type et calcul du score.
// Ces deux fonctions décident du classement d'un groupe — une erreur de
// scoring fausse le Hall of Fame et les couronnes.

const test = require('node:test');
const assert = require('node:assert');
const { loadInto } = require('./helpers/load');

const ctx = loadInto('js/supabase-client.js');
const { weeklyChallengeType, scoreChallenge, getChallengeMeta } = ctx;

const ROTATION = ['count', 'early', 'night', 'regular', 'rainbow', 'streak'];
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();

test('weeklyChallengeType — 6 lundis consécutifs donnent 6 types distincts', () => {
  const monday = new Date(2026, 0, 5);        // lundi 5 janvier 2026
  const vus = [];
  for (let i = 0; i < 6; i++) {
    vus.push(weeklyChallengeType(new Date(monday.getTime() + i * 7 * 86400000)));
  }
  assert.strictEqual(new Set(vus).size, 6, 'les 6 types doivent être distincts');
  assert.deepStrictEqual([...vus].sort(), [...ROTATION].sort());
});

test('weeklyChallengeType — la rotation reboucle à la 7e semaine', () => {
  const monday = new Date(2026, 0, 5);
  const s1 = weeklyChallengeType(monday);
  const s7 = weeklyChallengeType(new Date(monday.getTime() + 6 * 7 * 86400000));
  assert.strictEqual(s7, s1);
});

test('weeklyChallengeType — une date avant epoch ne casse pas le modulo', () => {
  // Le code fait ((idx % n) + n) % n justement pour ça : sans ce garde-fou,
  // un index négatif renverrait undefined.
  const type = weeklyChallengeType(new Date(1965, 5, 7));
  assert.ok(ROTATION.includes(type), `type inattendu : ${type}`);
});

test('scoreChallenge count — compte simplement les entrées', () => {
  const poops = [{ date: at(2026, 3, 2) }, { date: at(2026, 3, 3) }, { date: at(2026, 3, 3) }];
  assert.strictEqual(scoreChallenge('count', poops), 3);
  assert.strictEqual(scoreChallenge('type-inconnu', poops), 3, 'défaut = count');
  assert.strictEqual(scoreChallenge('count', []), 0);
});

test('scoreChallenge early — strictement avant 8h', () => {
  const poops = [
    { date: at(2026, 3, 2, 7) },   // compte
    { date: at(2026, 3, 2, 0) },   // compte
    { date: at(2026, 3, 2, 8) },   // 8h pile : ne compte pas
    { date: at(2026, 3, 2, 9) },
  ];
  assert.strictEqual(scoreChallenge('early', poops), 2);
});

test('scoreChallenge night — entre 0h et 6h exclus', () => {
  const poops = [
    { date: at(2026, 3, 2, 0) },   // compte
    { date: at(2026, 3, 2, 5) },   // compte
    { date: at(2026, 3, 2, 6) },   // 6h pile : ne compte pas
    { date: at(2026, 3, 2, 23) },
  ];
  assert.strictEqual(scoreChallenge('night', poops), 2);
});

test('scoreChallenge regular — jours distincts, pas nombre d\'entrées', () => {
  const poops = [
    { date: at(2026, 3, 2, 8) },
    { date: at(2026, 3, 2, 20) },  // même jour
    { date: at(2026, 3, 3) },
  ];
  assert.strictEqual(scoreChallenge('regular', poops), 2);
});

test('scoreChallenge rainbow — textures distinctes, texture absente = normal', () => {
  const poops = [
    { date: at(2026, 3, 2), texture: 'dur' },
    { date: at(2026, 3, 2), texture: 'dur' },
    { date: at(2026, 3, 2), texture: 'mou' },
    { date: at(2026, 3, 2) },                  // sans texture -> 'normal'
  ];
  assert.strictEqual(scoreChallenge('rainbow', poops), 3);
});

test('scoreChallenge streak — plus longue suite de jours consécutifs', () => {
  const poops = [
    { date: at(2026, 3, 1) },
    { date: at(2026, 3, 2) },
    { date: at(2026, 3, 3) },   // suite de 3
    // 4 mars manquant
    { date: at(2026, 3, 5) },
    { date: at(2026, 3, 6) },   // suite de 2
  ];
  assert.strictEqual(scoreChallenge('streak', poops), 3);
});

test('scoreChallenge streak — plusieurs entrées le même jour ne gonflent pas la série', () => {
  const poops = [
    { date: at(2026, 3, 1, 8) },
    { date: at(2026, 3, 1, 20) },
    { date: at(2026, 3, 2, 9) },
  ];
  assert.strictEqual(scoreChallenge('streak', poops), 2);
});

test('scoreChallenge streak — liste vide renvoie 0', () => {
  assert.strictEqual(scoreChallenge('streak', []), 0);
});

test('getChallengeMeta — retombe sur count pour un type inconnu', () => {
  assert.strictEqual(getChallengeMeta('nawak'), getChallengeMeta('count'));
  assert.ok(getChallengeMeta('early').title.length > 0);
});
