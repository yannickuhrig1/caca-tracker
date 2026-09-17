// Jeux du trône : logique des quatre jeux d'arcade (Plop!, Tour de PQ,
// Le Côlon, Course au trône). Le dessin n'est pas testé ici ; ce qui compte,
// c'est qu'un score ne tombe pas faux et qu'une partie finisse vraiment.

const test = require('node:test');
const assert = require('node:assert');
const { loadInto } = require('./helpers/load');

const ctx = loadInto(['js/jeux/jeux-core.js', 'js/jeux/plop.js', 'js/jeux/pq.js', 'js/jeux/colon.js', 'js/jeux/course.js']);
const { JeuPlop: P, JeuPQ: Q, JeuColon: C, JeuCourse: R, JeuxCore: J } = ctx;

// ---------- Plop! ----------

test('plopJudge : centre parfait, bord qui passe, à côté raté', () => {
  assert.strictEqual(P.plopJudge(0, 0.16), 'perfect');
  assert.strictEqual(P.plopJudge(0.16 * P.PLOP.PARFAIT, 0.16), 'perfect');
  assert.strictEqual(P.plopJudge(-0.1, 0.16), 'ok');
  assert.strictEqual(P.plopJudge(0.16, 0.16), 'ok');
  assert.strictEqual(P.plopJudge(0.2, 0.16), 'miss');
});

/** Lâche quand la cuvette est à `bowlX` et laisse tomber jusqu'à l'impact. */
function plopLacher(s, bowlX) {
  s.bowlX = bowlX;
  s.speed = 0;               // cuvette immobile : on teste le jugement, pas le timing
  assert.ok(P.plopDrop(s));
  for (let i = 0; i < 200; i++) {
    const ev = P.plopStep(s, 0.01);
    if (ev) return ev;
  }
  throw new Error('le caca n\'est jamais arrivé');
}

test('plopStep : un seul caca à la fois, et il finit par tomber', () => {
  const s = P.plopNew();
  assert.strictEqual(P.plopDrop(s), true);
  assert.strictEqual(P.plopDrop(s), false);
});

test('plopStep : la série de parfaits rapporte de plus en plus, un simple plop la casse', () => {
  const s = P.plopNew();
  assert.strictEqual(plopLacher(s, 0.5).gain, 3);
  assert.strictEqual(plopLacher(s, 0.5).gain, 4);
  assert.strictEqual(s.streak, 2);
  const ok = plopLacher(s, 0.5 - s.halfW * 0.8);
  assert.strictEqual(ok.type, 'ok');
  assert.strictEqual(s.streak, 0);
  assert.strictEqual(s.bestStreak, 2);
  assert.strictEqual(s.score, 3 + 4 + 1);
});

test('plopStep : trois éclaboussures et c\'est fini', () => {
  const s = P.plopNew();
  for (let i = 0; i < 3; i++) assert.strictEqual(plopLacher(s, 0.9).type, 'miss');
  assert.strictEqual(s.lives, 0);
  assert.strictEqual(s.over, true);
  assert.strictEqual(P.plopDrop(s), false);
});

test('plopStep : la cuvette reste dans l\'écran et accélère sans dépasser le maximum', () => {
  const s = P.plopNew();
  s.plops = 10;
  s.speed = P.PLOP.VITESSE_MAX;
  const rng = J.mulberry32(3);
  for (let i = 0; i < 2000; i++) {
    P.plopStep(s, 0.016, rng);
    assert.ok(s.bowlX >= s.halfW - 1e-9 && s.bowlX <= 1 - s.halfW + 1e-9);
    assert.ok(s.speed <= P.PLOP.VITESSE_MAX + 1e-9);
  }
});

// ---------- Tour de PQ ----------

test('pqPlace : pose parfaite garde la largeur', () => {
  const s = Q.pqNew();
  s.cur.x = s.stack[0].x + 1;
  const ev = Q.pqPlace(s);
  assert.strictEqual(ev.type, 'perfect');
  assert.strictEqual(ev.cut, null);
  assert.strictEqual(Q.pqHeight(s), 1);
  assert.strictEqual(s.stack[1].w, s.stack[0].w);
});

test('pqPlace : ce qui dépasse est coupé, des deux côtés', () => {
  const s = Q.pqNew();                       // base : x 20, w 60
  s.cur.x = 30;                              // dépasse de 10 à droite
  const ev = Q.pqPlace(s);
  assert.strictEqual(ev.type, 'place');
  assert.strictEqual(s.stack[1].x, 30);
  assert.strictEqual(s.stack[1].w, 50);
  assert.strictEqual(`${ev.cut.x}:${ev.cut.w}`, '80:10');

  s.cur.x = 20;                              // dépasse de 10 à gauche du rouleau de 50
  const ev2 = Q.pqPlace(s);
  assert.strictEqual(`${s.stack[2].x}:${s.stack[2].w}`, '30:40');
  assert.strictEqual(`${ev2.cut.x}:${ev2.cut.w}`, '20:10');
});

test('pqPlace : complètement à côté, fin de partie', () => {
  const s = Q.pqNew();
  s.cur.x = 85;
  assert.strictEqual(Q.pqPlace(s).type, 'over');
  assert.strictEqual(s.over, true);
  assert.strictEqual(Q.pqHeight(s), 0);
});

test('pqPlace : trois parfaites d\'affilée font regagner de la largeur, sans dépasser le départ', () => {
  const s = Q.pqNew();
  s.cur.x = 30; Q.pqPlace(s);                // rétréci à 50
  for (let i = 0; i < 3; i++) { s.cur.x = s.stack[s.stack.length - 1].x; Q.pqPlace(s); }
  const top = s.stack[s.stack.length - 1];
  assert.strictEqual(top.w, 50 + Q.PQ.BONUS_LARGEUR);
  assert.ok(top.x >= 0 && top.x + top.w <= Q.PQ.LARGEUR);
  for (let i = 0; i < 30; i++) { s.cur.x = s.stack[s.stack.length - 1].x; Q.pqPlace(s); }
  assert.ok(s.stack[s.stack.length - 1].w <= Q.PQ.ROULEAU_INIT);
});

test('pqStep : le rouleau fait demi-tour aux bords', () => {
  const s = Q.pqNew();
  for (let i = 0; i < 500; i++) {
    Q.pqStep(s, 0.02);
    assert.ok(s.cur.x >= -s.cur.w * 0.35 - 1e-9 && s.cur.x <= Q.PQ.LARGEUR - s.cur.w * 0.65 + 1e-9);
  }
});

// ---------- Le Côlon ----------

const vide = s => { s.items = []; return s; };

test('colonTurn : pas de demi-tour sur soi-même', () => {
  const s = C.colonNew(J.mulberry32(1));
  assert.strictEqual(C.colonTurn(s, 'down'), false);
  assert.strictEqual(C.colonTurn(s, 'left'), true);
  assert.strictEqual(C.colonTurn(s, 'inconnu'), false);
});

test('colonTick : une fibre fait grandir et marque un point', () => {
  const s = vide(C.colonNew(J.mulberry32(1)));
  const t = s.snake[0];
  s.items.push({ x: t.x, y: t.y - 1, type: 'fibre' });
  const ev = C.colonTick(s, J.mulberry32(2));
  assert.strictEqual(ev.type, 'fibre');
  assert.strictEqual(s.score, 1);
  C.colonTick(s, J.mulberry32(2));
  assert.strictEqual(s.snake.length, 4);
  assert.ok(s.items.some(i => i.type === 'fibre'), 'une nouvelle fibre apparaît');
});

test('colonTick : le fast-food retire 2 points (jamais sous 0) et raccourcit', () => {
  const s = vide(C.colonNew(J.mulberry32(1)));
  s.score = 1;
  s.snake = Array.from({ length: 7 }, (_, i) => ({ x: 5, y: 10 + i }));
  s.items.push({ x: 5, y: 9, type: 'burger' });
  assert.strictEqual(C.colonTick(s).type, 'burger');
  assert.strictEqual(s.score, 0);
  assert.strictEqual(s.snake.length, 5);
});

test('colonTick : le piment rapporte 3 et accélère un moment', () => {
  const s = vide(C.colonNew(J.mulberry32(1)));
  const t = s.snake[0];
  s.items.push({ x: t.x, y: t.y - 1, type: 'piment' });
  const normal = C.colonInterval(s);
  C.colonTick(s);
  assert.strictEqual(s.score, 3);
  assert.ok(C.colonInterval(s) < normal);
  for (let i = 0; i < C.COLON.PIMENT_PAS; i++) { s.items = []; s.snake[0].y = 15; s.snake = [s.snake[0], { x: s.snake[0].x, y: 16 }, { x: s.snake[0].x, y: 17 }]; C.colonTick(s); }
  assert.strictEqual(s.boost, 0);
});

test('colonTick : le mur et son propre corps tuent, la queue qui s\'en va non', () => {
  const mur = vide(C.colonNew());
  mur.snake = [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }];
  assert.strictEqual(C.colonTick(mur).type, 'over');

  // Carré de 4 : la tête va sur la case que la queue libère au même pas.
  const boucle = vide(C.colonNew());
  boucle.snake = [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }];
  boucle.dir = 'down'; boucle.next = 'down';
  assert.strictEqual(C.colonTick(boucle).type, 'move');

  const morsure = vide(C.colonNew());
  morsure.snake = [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }];
  morsure.dir = 'down'; morsure.next = 'down';
  assert.strictEqual(C.colonTick(morsure).type, 'over');
});

test('colonSpawn : jamais sur le serpent ni sur un autre objet', () => {
  const s = vide(C.colonNew());
  const rng = J.mulberry32(9);
  for (let i = 0; i < 60; i++) C.colonSpawn(s, 'fibre', rng);
  const cles = s.items.map(i => `${i.x},${i.y}`);
  assert.strictEqual(new Set(cles).size, cles.length);
  assert.ok(!s.items.some(i => s.snake.some(p => p.x === i.x && p.y === i.y)));
});

test('colonStep : pas de rattrapage fou après une mise en veille', () => {
  const s = vide(C.colonNew());
  s.snake = [{ x: 7, y: 15 }, { x: 7, y: 16 }, { x: 7, y: 17 }];
  const evs = C.colonStep(s, 60);
  assert.ok(evs.length <= 5);
});

// ---------- Course au trône ----------

test('courseJump : un seul saut à la fois, retombe au sol', () => {
  const s = R.courseNew();
  s.prochain = 1e9;
  assert.strictEqual(R.courseJump(s), true);
  R.courseStep(s, 0.05);
  assert.strictEqual(R.courseJump(s), false, 'pas de double saut');
  for (let i = 0; i < 100; i++) R.courseStep(s, 0.02);
  assert.strictEqual(s.py, 0);
  assert.strictEqual(R.courseJump(s), true);
});

test('courseStep : chaque obstacle est franchissable en sautant au bon moment', () => {
  Object.entries(R.COURSE.OBSTACLES).forEach(([kind, o]) => {
    [R.COURSE.VITESSE_INIT, R.COURSE.VITESSE_MAX].forEach(vitesse => {
      // On cherche une distance de déclenchement du saut qui passe l'obstacle.
      let franchi = false;
      for (let avance = 0; avance < 80 && !franchi; avance++) {
        const essai = R.courseNew();
        essai.prochain = 1e9;
        essai.speed = vitesse;
        const obs = { kind, x: R.COURSE.JOUEUSE_X + R.COURSE.JOUEUSE_W + avance, y: 0, w: o.w, h: o.h };
        essai.obstacles.push(obs);
        R.courseJump(essai);
        for (let i = 0; i < 300 && !essai.over && obs.x + obs.w > R.COURSE.JOUEUSE_X - 1; i++) R.courseStep(essai, 0.005);
        franchi = !essai.over;
      }
      assert.ok(franchi, `${kind} à ${vitesse}`);
    });
  });
});

test('courseStep : sans sauter, l\'obstacle arrête la course', () => {
  const s = R.courseNew();
  s.prochain = 1e9;
  s.obstacles.push({ kind: 'porte', x: 40, y: 0, w: 7, h: 13 });
  for (let i = 0; i < 200 && !s.over; i++) R.courseStep(s, 0.02);
  assert.strictEqual(s.reason, 'obstacle');
});

test('courseStep : jauge pleine = accident, les toilettes la vident', () => {
  const s = R.courseNew();
  s.prochain = 1e9;
  s.urgence = 99.9;
  s.pickups.push({ kind: 'wc', x: R.COURSE.JOUEUSE_X, y: 2, w: 8, h: 8 });
  const evs = R.courseStep(s, 0.05);
  assert.ok(evs.includes('wc'));
  assert.ok(s.urgence < 1);
  assert.strictEqual(s.over, false);
  assert.strictEqual(s.bonus, R.COURSE.BONUS_WC);

  const t = R.courseNew();
  t.prochain = 1e9;
  t.urgence = 99.99;
  R.courseStep(t, 0.1);
  assert.strictEqual(t.reason, 'accident');
});

test('courseScore : mètres parcourus plus bonus', () => {
  const s = R.courseNew();
  s.dist = 1234;
  s.bonus = 10;
  assert.strictEqual(R.courseScore(s), 133);
});

test('courseSpawn : l\'écart laisse toujours le temps de retomber', () => {
  const rng = J.mulberry32(5);
  const s = R.courseNew();
  for (let i = 0; i < 50; i++) {
    s.speed = R.COURSE.VITESSE_INIT + (i % 5) * 15;
    R.courseSpawn(s, 200, rng);
    const tempsSaut = (2 * R.COURSE.SAUT) / R.COURSE.GRAVITE;
    assert.ok(s.prochain >= s.speed * tempsSaut);
  }
});
