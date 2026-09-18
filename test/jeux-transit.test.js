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
  [0, 1, 2, 3, 4].forEach(i => {
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

// ---------- Allure : freiner ou pousser ----------

/**
 * Traverse une mâchoire posée 60 unités plus bas. `pilote(s, machoire)`
 * choisit l'allure à chaque instant. Rend true si le grain s'est fait croquer.
 */
function traverseMachoire(pilote, phase) {
  const s = T.transitNew();
  T.transitStartLevel(s, J.mulberry32(31));
  const machoire = { kind: 'machoire', y: s.y + 60, h: 12, x: 50, min: 2, max: 16, periode: 2, phase };
  s.objets = [machoire];
  s.x = 50; s.target = 50;
  s.allureTenue = true;            // pouce maintenu
  let croque = false;
  for (let i = 0; i < 60 * 20 && s.y < machoire.y + 30; i++) {
    T.transitSetAllure(s, pilote(s, machoire));
    if (T.transitStep(s, 1 / 60).some(e => e.type === 'degat')) croque = true;
  }
  return croque;
}

test('freiner puis foncer rend franchissable un passage perdu d\'avance', () => {
  // Cette mâchoire se referme pile au moment où le grain arrive à vitesse
  // normale : sans commande d'allure, il n'y avait aucune issue.
  assert.strictEqual(traverseMachoire(() => 1, 0.25), true, 'à vitesse imposée, on se fait croquer');

  // Freiner seul ne suffit pas : trop lent, on reste entre les dents pendant
  // qu'elles se referment. C'est voulu, le frein n'est pas une pause.
  assert.strictEqual(traverseMachoire(() => T.TRANSIT.ALLURE_MIN, 0.25), true, 'traverser au ralenti, c\'est se faire croquer');

  // Le bon geste : freiner à l'approche, attendre l'ouverture, puis foncer
  // et ne plus lâcher une fois engagé entre les dents.
  const technique = (s, m) => {
    const dist = m.y - s.y;
    const engage = Math.abs(dist) < m.h / 2 + T.TRANSIT.RAYON + 2;
    if (engage || T.transitOpen(m, s.t) > 0.6) return T.TRANSIT.ALLURE_MAX;
    return dist < 30 ? T.TRANSIT.ALLURE_MIN : 1;
  };
  assert.strictEqual(traverseMachoire(technique, 0.25), false, 'freiner puis foncer : on passe');
});

test('les mâchoires laissent le temps de freiner entre deux', () => {
  // Deux mâchoires trop proches, déphasées : à peine sorti de l'une, la
  // suivante se referme. Le joueur automatique y perdait sa partie.
  for (let g = 1; g <= 40; g++) {
    const m = T.transitBuildLevel(0, J.mulberry32(g)).filter(o => o.kind === 'machoire');
    m.slice(1).forEach((o, i) => assert.ok(o.y - m[i].y >= 80, `graine ${g} : ${Math.round(o.y - m[i].y)} unités entre deux mâchoires`));
  }
});

test('les méchantes bactéries s\'engagent : un écart de dernière seconde les évite', () => {
  const s = T.transitNew({ level: 4, carapace: 100, score: 0, stars: [3, 3, 3, 3] });
  T.transitStartLevel(s, J.mulberry32(34));
  // De loin, elle vise le grain…
  const xLoin = s.x + 20;
  const loin = { kind: 'mechante', y: s.y + 50, x: xLoin, r: 5 };
  s.objets = [loin];
  T.transitStep(s, 0.1);
  assert.ok(loin.x < xLoin, 'elle corrige sa trajectoire de loin');
  // …mais tout près, elle ne corrige plus : on peut encore l'esquiver.
  const xPres = s.x + 12;
  const pres = { kind: 'mechante', y: s.y + 15, x: xPres, r: 5 };
  s.objets = [pres];
  T.transitStep(s, 0.1);
  assert.strictEqual(pres.x, xPres, 'elle garde sa trajectoire dans les derniers mètres');
});

test('transitSetAllure : bornée, et l\'allure change vraiment la vitesse', () => {
  const s = T.transitNew();
  T.transitStartLevel(s, J.mulberry32(32));
  const normale = T.transitSpeed(s);
  assert.strictEqual(T.transitSetAllure(s, 0.01), T.TRANSIT.ALLURE_MIN, 'on ne s\'arrête jamais');
  assert.ok(T.transitSpeed(s) > 0);
  assert.ok(T.transitSpeed(s) < normale);
  assert.strictEqual(T.transitSetAllure(s, 99), T.TRANSIT.ALLURE_MAX);
  assert.ok(T.transitSpeed(s) > normale);
  assert.strictEqual(T.transitAllureLabel(s), 'pousse');
  T.transitSetAllure(s, 0.5);
  assert.strictEqual(T.transitAllureLabel(s), 'freine');
  T.transitSetAllure(s, 1);
  assert.strictEqual(T.transitAllureLabel(s), 'normal');
});

test('pouce levé : l\'allure revient d\'elle-même à la normale', () => {
  const s = T.transitNew();
  T.transitStartLevel(s, J.mulberry32(33));
  T.transitSetAllure(s, T.TRANSIT.ALLURE_MIN);
  s.allureTenue = false;
  for (let i = 0; i < 60; i++) T.transitStep(s, 1 / 60);   // 1 seconde
  assert.strictEqual(Math.round(s.allure * 100) / 100, 1);

  // Tant que le pouce tient, elle ne bouge pas toute seule.
  T.transitSetAllure(s, 1.8);
  s.allureTenue = true;
  for (let i = 0; i < 60; i++) T.transitStep(s, 1 / 60);
  assert.strictEqual(s.allure, 1.8);
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
  const s = T.transitNew({ level: 4, carapace: 100, score: 0, stars: [3, 3, 3, 3] });
  T.transitStartLevel(s, J.mulberry32(9));
  const debut = T.transitSpeed(s);
  s.y = T.TRANSIT.NIVEAUX[4].longueur * 0.9;
  assert.ok(T.transitSpeed(s) < debut * 0.85);
});

// ---------- L'œsophage : les vagues ----------

test('l\'anneau propulse quand il est ouvert, serre quand il est fermé', () => {
  const anneau = phase => ({ kind: 'anneau', y: 0, h: 14, periode: 2, phase });

  const s = T.transitNew({ level: 1, carapace: 100, score: 0, stars: [3] });
  T.transitStartLevel(s, J.mulberry32(21));
  const ouvert = anneau(0.5);          // cosinus au minimum : grand ouvert
  ouvert.y = s.y + 1;
  s.objets = [ouvert];
  assert.ok(T.transitOpen(ouvert, s.t) > 0.9, 'anneau bien ouvert');
  const evs = T.transitStep(s, 1 / 60);
  assert.ok(evs.some(e => e.type === 'vague'));
  assert.ok(s.boost > 0, 'la vague propulse');
  assert.strictEqual(s.carapace, 100);

  const f = T.transitNew({ level: 1, carapace: 100, score: 0, stars: [3] });
  T.transitStartLevel(f, J.mulberry32(21));
  const ferme = anneau(0);
  ferme.y = f.y + 1;
  f.objets = [ferme];
  assert.ok(T.transitOpen(ferme, f.t) < 0.1, 'anneau bien fermé');
  T.transitStep(f, 1 / 60);
  assert.strictEqual(f.carapace, 85);
});

test('le reflux freine la descente sans abîmer la carapace', () => {
  const s = T.transitNew({ level: 1, carapace: 100, score: 0, stars: [3] });
  T.transitStartLevel(s, J.mulberry32(22));
  s.objets = [{ kind: 'reflux', y: s.y + 10, h: 40, x1: 0, x2: 100 }];
  const depart = s.y;
  const evs = [];
  for (let i = 0; i < 30; i++) evs.push(...T.transitStep(s, 1 / 60));
  assert.ok(evs.some(e => e.type === 'reflux'));
  assert.strictEqual(s.carapace, 100, 'ça remonte, ça ne brûle pas');

  const libre = T.transitNew({ level: 1, carapace: 100, score: 0, stars: [3] });
  T.transitStartLevel(libre, J.mulberry32(22));
  libre.objets = [];
  for (let i = 0; i < 30; i++) T.transitStep(libre, 1 / 60);
  assert.ok(s.y - depart < libre.y, 'la remontée freine vraiment');
});

// ---------- L'intestin grêle : aspiration et bile ----------

test('les villosités aspirent vers leur paroi, la carapace durcie résiste mieux', () => {
  const aspiration = bouclier => {
    const s = T.transitNew({ level: 3, carapace: 100, score: 0, stars: [3, 3, 3] });
    T.transitStartLevel(s, J.mulberry32(23));
    s.objets = [{ kind: 'villosite', y: s.y + 1, h: 60, cote: 'left' }];
    if (bouclier) T.transitShield(s);
    const depart = s.x;
    T.transitSetTarget(s, depart);
    T.transitStep(s, 0.5);
    return depart - s.x;
  };
  const libre = aspiration(false);
  assert.ok(libre > 1, `aspiration trop faible : ${libre}`);
  assert.ok(aspiration(true) < libre, 'le bouclier freine l\'aspiration');
});

test('le jet de bile ne brûle que quand il jaillit, et seulement à sa portée', () => {
  const jet = (phase, placer) => {
    const s = T.transitNew({ level: 3, carapace: 100, score: 0, stars: [3, 3, 3] });
    T.transitStartLevel(s, J.mulberry32(24));
    const w = T.transitWalls(s.y, 3);
    s.x = placer(w);
    s.target = s.x;
    s.objets = [{ kind: 'bile', y: s.y + 1, h: 10, cote: 'left', portee: 0.4, periode: 2, phase }];
    T.transitStep(s, 1 / 60);
    return s.carapace;
  };
  const pres = w => w.left + 6;
  const loin = w => w.right - 6;
  assert.strictEqual(jet(0.5, pres), 80, 'jet actif, grain à portée');
  assert.strictEqual(jet(0, pres), 100, 'jet au repos');
  assert.strictEqual(jet(0.5, loin), 100, 'grain hors de portée');
});

test('la vitamine répare un peu et rapporte des points', () => {
  const s = T.transitNew({ level: 3, carapace: 70, score: 0, stars: [3, 3, 3] });
  T.transitStartLevel(s, J.mulberry32(25));
  s.objets = [{ kind: 'vitamine', y: s.y + 1, x: s.x, r: 5 }];
  T.transitStep(s, 1 / 60);
  assert.strictEqual(s.carapace, 78);
  assert.strictEqual(s.score, 15);
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
  assert.strictEqual(J.normalizeTransitCheckpoint({ level: 3, carapace: 50, score: 10 }).level, 3, 'l\'intestin grêle est une reprise valable');
  assert.strictEqual(J.normalizeTransitCheckpoint(null), null);
});

test('arrivée : partie finie, bonus final, plus rien à reprendre', () => {
  const s = T.transitNew({ level: 4, carapace: 100, score: 500, stars: [3, 3, 3, 3] });
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
  assert.strictEqual(r.stars, 15);
});

test('les cinq organes s\'enchaînent et l\'horloge ne recule jamais', () => {
  assert.strictEqual(T.TRANSIT.NIVEAUX.length, 5, 'bouche, œsophage, estomac, grêle, côlon');
  let precedent = -1;
  T.TRANSIT.NIVEAUX.forEach(niv => {
    assert.ok(niv.heures[0] >= precedent, `${niv.id} commence avant la fin du précédent`);
    assert.ok(niv.heures[1] > niv.heures[0], `${niv.id} : durée nulle`);
    precedent = niv.heures[1];
  });
  assert.strictEqual(T.TRANSIT.NIVEAUX[0].heures[0], 0);
  assert.strictEqual(T.TRANSIT.NIVEAUX[4].heures[1], 36, 'la sortie est à 36 h');

  const s = T.transitNew();
  T.transitStartLevel(s, J.mulberry32(15));
  assert.ok(T.transitClock(s) < 0.05);
  s.level = 4;
  T.transitStartLevel(s, J.mulberry32(15));
  assert.strictEqual(Math.round(T.transitClock(s)), 10);
  s.y = T.TRANSIT.NIVEAUX[4].longueur;
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
