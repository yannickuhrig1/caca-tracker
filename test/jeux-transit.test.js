// Le Grand Transit : parcours du grain de maïs.
//
// Deux choses comptent vraiment ici. D'abord qu'un niveau soit franchissable :
// une porte qui ne s'ouvre jamais assez, ou un obstacle posé dans la paroi,
// bloquent la partie sans le dire. Ensuite la sauvegarde par organe : mal
// relue, elle renvoie la joueuse au début après vingt minutes de jeu.

const test = require('node:test');
const assert = require('node:assert');
const { loadInto } = require('./helpers/load');

const ctx = loadInto(['js/jeux/jeux-core.js', 'js/jeux/transit.js']);
const { JeuTransit: T, JeuxCore: J } = ctx;
const R = T.TRANSIT.RAYON;

/** Joue un niveau entier en pilotant le grain vers `viser(s)`. */
function jouer(s, viser, dt = 1 / 60, maxS = 400) {
  const evs = [];
  for (let i = 0; i < maxS / dt && s.phase === 'play'; i++) {
    T.transitSetTarget(s, viser(s));
    evs.push(...T.transitStep(s, dt));
  }
  return evs;
}

// ---------- Construction des niveaux ----------

test('chaque organe pose ses obstacles dans le tube, triés, et finit par sa porte', () => {
  T.TRANSIT.NIVEAUX.forEach((niv, i) => {
    const objets = T.transitBuildLevel(i, J.mulberry32(7 + i));
    assert.ok(objets.length > 8, `${niv.id} : ${objets.length} objets`);
    let dernier = -1;
    objets.forEach(o => {
      assert.ok(o.y >= dernier, `${niv.id} : objets triés`);
      dernier = o.y;
      const w = T.transitWalls(o.y, i);
      if (o.x !== undefined && o.kind !== 'porte') {
        assert.ok(o.x >= w.left - 1 && o.x <= w.right + 1, `${niv.id} : ${o.kind} hors du tube`);
      }
      if (o.x1 !== undefined) assert.ok(o.x1 >= w.left - 1 && o.x2 <= w.right + 1, `${niv.id} : ${o.kind} déborde`);
    });
    const fin = objets[objets.length - 1];
    assert.strictEqual(fin.kind, niv.id === 'bouche' ? 'epiglotte' : 'porte');
    assert.ok(fin.y < niv.longueur, 'la porte est avant la fin du niveau');
  });
});

test('mâchoires et portes s\'ouvrent assez pour laisser passer le grain', () => {
  [0, 1, 2].forEach(i => {
    T.transitBuildLevel(i, J.mulberry32(3 + i))
      .filter(o => o.kind === 'machoire' || o.kind === 'porte')
      .forEach(o => {
        let maxi = 0;
        for (let t = 0; t < o.periode; t += 0.02) maxi = Math.max(maxi, T.transitGapHalf(o, t));
        assert.ok(maxi > R + 1, `${o.kind} : passage max ${maxi.toFixed(1)} pour un grain de ${R}`);
        // Et elle se referme vraiment, sinon il n'y a plus de défi.
        let mini = 99;
        for (let t = 0; t < o.periode; t += 0.02) mini = Math.min(mini, T.transitGapHalf(o, t));
        assert.ok(mini < R, `${o.kind} : ne se ferme jamais`);
      });
  });
});

// ---------- Déplacement et parois ----------

test('le grain reste entre les parois, même en visant dehors', () => {
  const s = T.transitNew();
  T.transitStartLevel(s, J.mulberry32(1));
  for (let i = 0; i < 600; i++) {
    T.transitSetTarget(s, i % 120 < 60 ? -50 : 150);
    T.transitStep(s, 1 / 60);
    const w = T.transitWalls(s.y, s.level);
    assert.ok(s.x >= w.left + R - 0.01 && s.x <= w.right - R + 0.01, `x=${s.x.toFixed(1)}`);
  }
});

test('la carapace ne descend pas sous zéro et la fin arrive', () => {
  const s = T.transitNew();
  T.transitStartLevel(s, J.mulberry32(2));
  s.carapace = 5;
  const evs = jouer(s, () => 50);
  assert.ok(s.carapace >= 0);
  assert.ok(['dead', 'clear', 'done'].includes(s.phase), s.phase);
  if (s.phase === 'dead') assert.ok(evs.some(e => e.type === 'digere'));
});

// ---------- Bouclier ----------

test('le bouclier bloque les dégâts, puis se recharge', () => {
  const s = T.transitNew();
  T.transitStartLevel(s, J.mulberry32(4));
  assert.strictEqual(T.transitShield(s), true);
  assert.strictEqual(T.transitShield(s), false, 'pas deux fois de suite');
  s.objets = [{ kind: 'pepsine', y: s.y + 1, x: s.x, r: 5, vx: 0 }];
  const evs = T.transitStep(s, 1 / 60);
  assert.ok(evs.some(e => e.type === 'bloque'));
  assert.strictEqual(s.carapace, T.TRANSIT.CARAPACE);
  // Sans bouclier, le même ennemi mord.
  const t = T.transitNew();
  T.transitStartLevel(t, J.mulberry32(4));
  t.objets = [{ kind: 'pepsine', y: t.y + 1, x: t.x, r: 5, vx: 0 }];
  T.transitStep(t, 1 / 60);
  assert.ok(t.carapace < T.TRANSIT.CARAPACE);
});

test('un dégât rend invulnérable un instant : pas de mort en rafale', () => {
  const s = T.transitNew();
  T.transitStartLevel(s, J.mulberry32(5));
  s.objets = [
    { kind: 'mechante', y: s.y + 1, x: s.x, r: 6 },
    { kind: 'mechante', y: s.y + 2, x: s.x, r: 6 },
    { kind: 'mechante', y: s.y + 3, x: s.x, r: 6 },
  ];
  T.transitStep(s, 1 / 60);
  assert.strictEqual(s.carapace, 80, 'une seule morsure encaissée');
  assert.ok(s.invuln > 0);
});

// ---------- Bonus ----------

test('bulles, bactéries gentilles et gaz : soin, points et propulsion', () => {
  const s = T.transitNew();
  T.transitStartLevel(s, J.mulberry32(6));
  s.carapace = 50;
  s.objets = [{ kind: 'bulle', y: s.y + 1, x: s.x, r: 5 }];
  T.transitStep(s, 1 / 60);
  assert.strictEqual(s.carapace, 62);

  s.objets = [{ kind: 'gentille', y: s.y + 1, x: s.x, r: 5 }];
  const avant = s.score;
  T.transitStep(s, 1 / 60);
  assert.strictEqual(s.score, avant + 15);

  s.objets = [{ kind: 'gaz', y: s.y + 1, x: s.x, r: 5 }];
  const lent = T.transitSpeed(s);
  const evs = T.transitStep(s, 1 / 60);
  assert.ok(evs.some(e => e.type === 'gaz'));
  assert.ok(T.transitSpeed(s) > lent, 'le gaz propulse');

  // La carapace ne dépasse jamais 100.
  s.carapace = 96;
  s.objets = [{ kind: 'bulle', y: s.y + 1, x: s.x, r: 5 }];
  T.transitStep(s, 1 / 60);
  assert.strictEqual(s.carapace, T.TRANSIT.CARAPACE);
});

test('l\'épiglotte punit la trachée et renvoie à gauche', () => {
  const s = T.transitNew();
  T.transitStartLevel(s, J.mulberry32(8));
  s.x = 70; s.target = 70;
  s.objets = [{ kind: 'epiglotte', y: s.y + 1, h: 10 }];
  const evs = T.transitStep(s, 1 / 60);
  assert.ok(evs.some(e => e.type === 'fausseRoute'));
  assert.strictEqual(s.carapace, 70);
  assert.ok(s.x < 50, 'remis du bon côté');

  // À gauche, on passe sans rien.
  const t = T.transitNew();
  T.transitStartLevel(t, J.mulberry32(8));
  t.x = 30; t.target = 30;
  t.objets = [{ kind: 'epiglotte', y: t.y + 1, h: 10 }];
  assert.strictEqual(T.transitStep(t, 1 / 60).length, 0);
  assert.strictEqual(t.carapace, T.TRANSIT.CARAPACE);
});

test('le côlon ralentit à mesure qu\'il pompe l\'eau', () => {
  const s = T.transitNew({ level: 2, carapace: 100, score: 0, stars: [3, 3] });
  T.transitStartLevel(s, J.mulberry32(9));
  const debut = T.transitSpeed(s);
  s.y = T.TRANSIT.NIVEAUX[2].longueur * 0.9;
  assert.ok(T.transitSpeed(s) < debut * 0.85);
});

// ---------- Enchaînement des organes et sauvegarde ----------

test('un organe franchi donne des étoiles, sauvegarde, et mène au suivant', () => {
  const s = T.transitNew();
  T.transitStartLevel(s, J.mulberry32(11));
  s.objets = [];                      // couloir vide : on regarde l'enchaînement
  const evs = jouer(s, () => 50);
  assert.ok(evs.some(e => e.type === 'niveau'));
  assert.strictEqual(s.phase, 'clear');
  assert.strictEqual(s.stars[0], 3, 'carapace intacte = 3 étoiles');
  assert.ok(s.score > 0);

  assert.strictEqual(T.transitNextLevel(s), true);
  assert.strictEqual(s.level, 1);
  assert.strictEqual(s.phase, 'intro');
  assert.strictEqual(T.transitNextLevel(s), false, 'seulement depuis l\'écran de fin d\'organe');
});

test('la sauvegarde reprend au début de l\'organe, pas à la bouche', () => {
  const s = T.transitNew();
  T.transitStartLevel(s, J.mulberry32(12));
  s.objets = [];
  jouer(s, () => 50);
  T.transitNextLevel(s);
  s.carapace = 64;
  T.transitStartLevel(s, J.mulberry32(13));
  const cp = T.transitCheckpoint(s);
  assert.strictEqual(cp.level, 1);
  assert.strictEqual(cp.carapace, 64);

  // Le grain se fait digérer : la reprise repart de l'estomac, pas de zéro.
  s.carapace = 0; s.phase = 'dead'; s.over = true;
  const repris = T.transitNew(T.transitCheckpoint(s));
  assert.strictEqual(repris.level, 1);
  assert.strictEqual(repris.resumed, true);
  assert.strictEqual(repris.carapace, 64);
  assert.strictEqual(repris.score, cp.score);
});

test('une sauvegarde abîmée ne bloque pas le jeu', () => {
  assert.strictEqual(T.transitNew({ level: 9, carapace: 50, score: 0 }).level, 0);
  assert.strictEqual(T.transitNew({ level: 'x' }).level, 0);
  assert.strictEqual(T.transitNew(null).resumed, false);
  // Le noyau nettoie aussi ce qui vient du stockage
  assert.strictEqual(J.normalizeTransitCheckpoint({ level: 2, carapace: 300, score: -5 }).carapace, 100);
  assert.strictEqual(J.normalizeTransitCheckpoint({ level: 2, carapace: 40, score: -5 }).score, 0);
  assert.strictEqual(J.normalizeTransitCheckpoint({ level: 7 }), null);
  assert.strictEqual(J.normalizeTransitCheckpoint(null), null);
});

test('arrivée : partie finie, bonus final, plus rien à reprendre', () => {
  const s = T.transitNew({ level: 2, carapace: 100, score: 500, stars: [3, 3] });
  T.transitStartLevel(s, J.mulberry32(14));
  s.objets = [];
  jouer(s, () => 50);
  assert.strictEqual(s.phase, 'done');
  assert.strictEqual(s.finished, true);
  assert.ok(s.score > 500 + 200);
  assert.strictEqual(T.transitCheckpoint(s), null, 'rien à reprendre après la sortie');
  const r = T.transitResult(s);
  assert.strictEqual(r.finished, true);
  assert.strictEqual(r.carapace, 100);
  assert.strictEqual(r.stars, 9);
});

test('l\'horloge du transit avance de la bouche (0 h) au côlon (36 h)', () => {
  const s = T.transitNew();
  T.transitStartLevel(s, J.mulberry32(15));
  assert.ok(T.transitClock(s) < 0.05);
  s.level = 2;
  T.transitStartLevel(s, J.mulberry32(15));
  assert.strictEqual(Math.round(T.transitClock(s)), 10);
  s.y = T.TRANSIT.NIVEAUX[2].longueur;
  assert.strictEqual(Math.round(T.transitClock(s)), 36);
});

// ---------- Intégration au reste des jeux ----------

test('une traversée complète compte pour les badges, pas un abandon', () => {
  const perdu = J.recordGame(null, 'transit', { score: 300, finished: false, carapace: 0 });
  assert.strictEqual(perdu.stats.records.transitFinished, 0);
  assert.strictEqual(J.gameBadgeStates(perdu.stats).grandTransit.done, false);

  const gagne = J.recordGame(perdu.stats, 'transit', { score: 900, finished: true, carapace: 92 });
  assert.strictEqual(gagne.stats.records.transitFinished, 1);
  const badges = J.gameBadgeStates(gagne.stats);
  assert.strictEqual(badges.grandTransit.done, true);
  assert.strictEqual(badges.ressortiIntact.done, true);
  assert.strictEqual(J.gameBadgeStates(J.recordGame(null, 'transit', { score: 1, finished: true, carapace: 40 }).stats).ressortiIntact.done, false);
});
