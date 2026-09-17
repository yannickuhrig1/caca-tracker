// ============================================================
//  transit.js — Le Grand Transit 🌽
//  On est un grain de maïs : avalé dans la bouche, il doit ressortir
//  en traversant l'estomac puis le côlon. On glisse le pouce pour se
//  déplacer, on tape pour durcir sa carapace un instant.
//  Trois organes, une sauvegarde au début de chacun : la traversée peut
//  s'étaler sur plusieurs séances, comme un vrai transit.
//  Coordonnées du monde : largeur 100, y vers le bas = profondeur.
//  Logique pure testée : test/jeux-transit.test.js
// ============================================================

const TRANSIT = {
  RAYON: 4,
  VITESSE_X: 170,          // unités/s vers la cible du pouce
  BOUCLIER_S: 0.9,
  RECHARGE_S: 3.5,
  INVULN_S: 1,
  CARAPACE: 100,
  NIVEAUX: [
    {
      id: 'bouche', nom: 'La bouche', emoji: '👄', vitesse: 40, longueur: 2400, heures: [0, 0.03],
      fond: ['#fecdd3', '#fb7185'], paroi: '#be123c',
      intro: 'Tu viens d\'être croqué. Évite les molaires, et à la fin, prends à GAUCHE : à droite, c\'est la trachée.',
      anecdote: 'On mâche mal le maïs : son enveloppe résiste aux dents comme à la digestion.',
    },
    {
      id: 'oesophage', nom: 'L\'œsophage', emoji: '🌊', vitesse: 55, longueur: 1600, heures: [0.03, 0.06],
      fond: ['#fbcfe8', '#9d174d'], paroi: '#831843',
      intro: 'Le tube te pousse vers le bas par vagues. Traverse un anneau au moment où il s\'ouvre : il te propulse. Fermé, il te serre. Évite les remontées acides 🫧, elles te font remonter.',
      anecdote: 'L\'œsophage ne laisse pas tomber : ses muscles poussent la nourriture en vagues. On peut avaler la tête en bas.',
    },
    {
      id: 'estomac', nom: 'L\'estomac', emoji: '⚗️', vitesse: 45, longueur: 3200, heures: [0.06, 4],
      fond: ['#fed7aa', '#c2410c'], paroi: '#7c2d12',
      intro: 'Bain d\'acide ! Les flaques rongent ta carapace, les enzymes ✂️ coupent. Les bulles te réparent.',
      anecdote: 'L\'acide de l\'estomac est assez fort pour dissoudre du métal, mais sa paroi se renouvelle sans cesse.',
    },
    {
      id: 'grele', nom: 'L\'intestin grêle', emoji: '🧬', vitesse: 48, longueur: 4000, heures: [4, 10],
      fond: ['#fef3c7', '#b45309'], paroi: '#78350f',
      intro: 'Six mètres de couloir tapissé de villosités : elles aspirent tout sur leur passage. Les jets de bile 💛 brûlent, les enzymes ✂️ coupent. Attrape les vitamines 💊.',
      anecdote: 'Déplié, l\'intestin grêle mesure 6 à 7 m. Ses villosités offrent une surface d\'absorption grande comme un court de tennis.',
    },
    {
      id: 'colon', nom: 'Le côlon', emoji: '🦠', vitesse: 50, longueur: 3800, heures: [10, 36],
      fond: ['#fde68a', '#92400e'], paroi: '#78350f',
      intro: 'Dernière ligne droite. Ici vivent les bactéries : les gentilles aident, les méchantes attaquent. Un pet 💨 te propulse, mais l\'eau s\'en va et tout ralentit.',
      anecdote: 'Ton intestin abrite près de 100 000 milliards de bactéries. Le côlon récupère l\'eau : tout ralentit et durcit.',
    },
  ],
};

// ---- Géométrie ----

/** Bords gauche et droit du tube à la profondeur y (ils ondulent). */
function transitWalls(y, niveau = 0) {
  const ampl = [5, 10, 8, 7, 6][niveau] ?? 6;
  const g = 7 + ampl * (0.5 + 0.5 * Math.sin(y / 45 + niveau));
  const d = 7 + ampl * (0.5 + 0.5 * Math.sin(y / 38 + 1.7 + niveau));
  return { left: g, right: 100 - d };
}

/** Ouverture d'une mâchoire ou d'un sphincter à l'instant t : 0 fermé, 1 grand ouvert. */
function transitOpen(o, t) {
  return 0.5 - 0.5 * Math.cos(2 * Math.PI * (t / o.periode + o.phase));
}

/** Demi-largeur du passage d'une porte à l'instant t. */
function transitGapHalf(o, t) {
  return o.min + transitOpen(o, t) * (o.max - o.min);
}

// ---- Construction d'un niveau ----

const TRANSIT_TIRAGES = {
  bouche:    [['machoire', 5], ['miette', 3], ['miette2', 1]],
  oesophage: [['anneau', 5], ['reflux', 3], ['miette', 2]],
  estomac:   [['acide', 4], ['pepsine', 3], ['bulle', 2], ['miette', 1]],
  grele:     [['villosite', 4], ['bile', 3], ['pepsine', 2], ['vitamine', 3]],
  colon:     [['mechante', 4], ['bouchon', 2], ['gentille', 3], ['gaz', 2]],
};

function transitPick(table, rng) {
  const total = table.reduce((a, [, p]) => a + p, 0);
  let r = rng() * total;
  for (const [nom, p] of table) { if ((r -= p) < 0) return nom; }
  return table[table.length - 1][0];
}

/**
 * Obstacles et bonus d'un niveau, triés par profondeur. Tout ce qui est
 * posé l'est entre les parois, et chaque niveau finit par sa porte :
 * l'épiglotte (bouche), le pylore (estomac), le sphincter (côlon).
 */
function transitBuildLevel(index, rng = Math.random) {
  const niv = TRANSIT.NIVEAUX[index];
  const objets = [];
  const dansLeTube = (y, marge) => {
    const w = transitWalls(y, index);
    return w.left + marge + rng() * Math.max(1, w.right - w.left - 2 * marge);
  };
  let y = 160;
  const fin = niv.longueur - 220;
  while (y < fin) {
    const kind = transitPick(TRANSIT_TIRAGES[niv.id], rng);
    if (kind === 'machoire') {
      const w = transitWalls(y, index);
      const centre = w.left + 20 + rng() * Math.max(1, w.right - w.left - 40);
      objets.push({ kind, y, h: 12, x: centre, min: 2, max: 16, periode: 1.4 + rng() * 0.8, phase: rng() });
    } else if (kind === 'miette' || kind === 'miette2') {
      objets.push({ kind: 'miette', y, x: dansLeTube(y, 8), r: 3.5 });
      if (kind === 'miette2') objets.push({ kind: 'miette', y: y + 14, x: dansLeTube(y + 14, 8), r: 3.5 });
    } else if (kind === 'anneau') {
      // Anneau musculaire sur toute la largeur : c'est le MOMENT qui compte,
      // pas la position. Ouvert il propulse, fermé il serre.
      objets.push({ kind, y, h: 14, periode: 1.6 + rng() * 0.9, phase: rng() });
    } else if (kind === 'reflux') {
      const w = transitWalls(y, index);
      const largeur = 20 + rng() * 18;
      const x1 = w.left + rng() * Math.max(1, w.right - w.left - largeur);
      objets.push({ kind, y, h: 22, x1, x2: x1 + largeur });
    } else if (kind === 'villosite') {
      // Frange de villosités collée à une paroi : elle aspire vers elle.
      objets.push({ kind, y, h: 26, cote: rng() < 0.5 ? 'left' : 'right' });
    } else if (kind === 'bile') {
      const w = transitWalls(y, index);
      const cote = rng() < 0.5 ? 'left' : 'right';
      objets.push({ kind, y, h: 7, cote, portee: 0.45 + rng() * 0.3, periode: 1.8 + rng() * 1.2, phase: rng(), mur: cote === 'left' ? w.left : w.right });
    } else if (kind === 'vitamine') {
      objets.push({ kind, y, x: dansLeTube(y, 8), r: 4 });
    } else if (kind === 'acide') {
      const w = transitWalls(y, index);
      const largeur = 22 + rng() * 22;
      const x1 = w.left + rng() * Math.max(1, w.right - w.left - largeur);
      objets.push({ kind, y, h: 16, x1, x2: x1 + largeur });
    } else if (kind === 'pepsine') {
      objets.push({ kind, y, x: dansLeTube(y, 10), r: 4.5, vx: (rng() < 0.5 ? -1 : 1) * (18 + rng() * 22) });
    } else if (kind === 'bulle') {
      objets.push({ kind, y, x: dansLeTube(y, 8), r: 4 });
    } else if (kind === 'mechante') {
      objets.push({ kind, y, x: dansLeTube(y, 10), r: 5 });
    } else if (kind === 'bouchon') {
      const w = transitWalls(y, index);
      const largeur = 16 + rng() * 14;
      const x1 = w.left + rng() * Math.max(1, w.right - w.left - largeur);
      objets.push({ kind, y, h: 9, x1, x2: x1 + largeur });
    } else if (kind === 'gentille') {
      objets.push({ kind, y, x: dansLeTube(y, 8), r: 4 });
    } else if (kind === 'gaz') {
      objets.push({ kind, y, x: dansLeTube(y, 8), r: 4 });
    }
    y += 55 + rng() * 45 - Math.min(20, index * 6);
  }
  const yPorte = niv.longueur - 120;
  if (niv.id === 'bouche') {
    // Carrefour : à gauche l'œsophage, à droite la trachée.
    objets.push({ kind: 'epiglotte', y: yPorte, h: 10 });
  } else {
    const portes = {
      oesophage: { nom: 'cardia',    periode: 2 },
      estomac:   { nom: 'pylore',    periode: 2.2 },
      grele:     { nom: 'valvule',   periode: 2.4 },
      colon:     { nom: 'sphincter', periode: 2.6 },
    };
    const p = portes[niv.id];
    objets.push({ kind: 'porte', nom: p.nom, y: yPorte, h: 12, x: 50, min: 2.5, max: 15, periode: p.periode, phase: rng() });
  }
  return objets.sort((a, b) => a.y - b.y);
}

// ---- État ----

function transitNew(checkpoint = null) {
  const cp = checkpoint && Number.isInteger(checkpoint.level) && checkpoint.level >= 0 && checkpoint.level < TRANSIT.NIVEAUX.length
    ? checkpoint : null;
  return {
    phase: 'intro',
    level: cp ? cp.level : 0,
    resumed: !!cp,
    carapace: cp ? Math.max(20, Math.min(TRANSIT.CARAPACE, cp.carapace)) : TRANSIT.CARAPACE,
    score: cp ? Math.max(0, cp.score) : 0,
    levelStart: null,       // { carapace, score } au début de l'organe (sauvegarde)
    stars: cp && Array.isArray(cp.stars) ? [...cp.stars] : [],
    x: 50, target: 50, y: 0, t: 0,
    shield: 0, recharge: 0, invuln: 0, boost: 0,
    objets: [],
    over: false, finished: false,
    lastLevelStars: 0,
  };
}

function transitLevel(s) { return TRANSIT.NIVEAUX[s.level]; }

function transitStartLevel(s, rng = Math.random) {
  s.objets = transitBuildLevel(s.level, rng);
  s.y = 0; s.t = 0;
  s.x = 50; s.target = 50;
  s.shield = 0; s.recharge = 0; s.invuln = 0; s.boost = 0;
  s.levelStart = { level: s.level, carapace: s.carapace, score: s.score, stars: [...s.stars] };
  s.phase = 'play';
}

/** Heure simulée du transit pendant le niveau (en heures). */
function transitClock(s) {
  const niv = transitLevel(s);
  if (!niv) return TRANSIT.NIVEAUX[TRANSIT.NIVEAUX.length - 1].heures[1];
  const p = s.phase === 'play' ? Math.min(1, s.y / niv.longueur) : s.phase === 'intro' ? 0 : 1;
  return niv.heures[0] + p * (niv.heures[1] - niv.heures[0]);
}

function transitSetTarget(s, x) {
  s.target = Math.max(0, Math.min(100, x));
}

/** Tape : durcit la carapace si la recharge est finie. Rend true si activé. */
function transitShield(s) {
  if (s.phase !== 'play' || s.recharge > 0) return false;
  s.shield = TRANSIT.BOUCLIER_S;
  s.recharge = TRANSIT.RECHARGE_S;
  return true;
}

/** Vitesse de descente : le côlon ralentit à mesure qu'il réabsorbe l'eau ; le gaz propulse. */
function transitSpeed(s) {
  const niv = transitLevel(s);
  let v = niv.vitesse;
  if (niv.id === 'colon') v *= 1 - 0.25 * Math.min(1, s.y / niv.longueur);
  if (s.boost > 0) v *= 1.8;
  return v;
}

function transitDamage(s, points, evs, cause) {
  if (s.shield > 0 || s.invuln > 0 || s.boost > 0) { evs.push({ type: 'bloque', cause }); return; }
  s.carapace = Math.max(0, s.carapace - points);
  s.invuln = TRANSIT.INVULN_S;
  evs.push({ type: 'degat', cause, points });
  if (s.carapace <= 0) { s.over = true; s.phase = 'dead'; evs.push({ type: 'digere', cause }); }
}

function transitStars(carapace) {
  return carapace >= 80 ? 3 : carapace >= 50 ? 2 : 1;
}

/**
 * Avance de `dt` secondes pendant la phase de jeu. Rend les événements :
 * degat, bloque, digere, bonus, fausseRoute, gaz, niveau (organe franchi).
 */
function transitStep(s, dt) {
  const evs = [];
  if (s.phase !== 'play') return evs;
  const niv = transitLevel(s);
  const R = TRANSIT.RAYON;
  s.t += dt;
  s.shield = Math.max(0, s.shield - dt);
  s.recharge = Math.max(0, s.recharge - dt);
  s.invuln = Math.max(0, s.invuln - dt);
  s.boost = Math.max(0, s.boost - dt);

  // Déplacement latéral vers le pouce, borné par les parois
  const pas = TRANSIT.VITESSE_X * dt;
  s.x += Math.max(-pas, Math.min(pas, s.target - s.x));
  s.y += transitSpeed(s) * dt;
  const w = transitWalls(s.y, s.level);
  s.x = Math.max(w.left + R, Math.min(w.right - R, s.x));

  for (const o of s.objets) {
    if (o.done) continue;
    const dy = Math.abs(o.y - s.y);
    // Les enzymes vont et viennent, les méchantes bactéries te suivent.
    if (o.kind === 'pepsine') {
      o.x += o.vx * dt;
      const wo = transitWalls(o.y, s.level);
      if (o.x < wo.left + o.r || o.x > wo.right - o.r) { o.vx *= -1; o.x = Math.max(wo.left + o.r, Math.min(wo.right - o.r, o.x)); }
    }
    if (o.kind === 'villosite' && dy < o.h / 2 + R) {
      // Aspiration latérale : il faut tirer contre pour rester au milieu.
      const wo = transitWalls(s.y, s.level);
      const vers = o.cote === 'left' ? wo.left : wo.right;
      const force = (s.shield > 0 ? 8 : 20) * dt;
      s.x += Math.sign(vers - s.x) * Math.min(Math.abs(vers - s.x), force);
      if (!o.vu) { o.vu = true; evs.push({ type: 'aspire', cote: o.cote }); }
    }
    if (o.kind === 'mechante' && o.y > s.y && o.y - s.y < 70) {
      o.x += Math.sign(s.x - o.x) * Math.min(Math.abs(s.x - o.x), 14 * dt);
    }
    if (dy > 20) continue;

    const rond = o.r !== undefined && Math.hypot(o.x - s.x, o.y - s.y) < o.r + R;
    switch (o.kind) {
      case 'machoire':
      case 'porte': {
        if (dy >= o.h / 2 + R) break;
        const half = transitGapHalf(o, s.t);
        if (s.x - R < o.x - half || s.x + R > o.x + half) {
          if (!o.hit) { o.hit = true; transitDamage(s, o.kind === 'porte' ? 30 : 25, evs, o.nom || o.kind); }
        }
        break;
      }
      case 'epiglotte':
        if (dy < o.h / 2 + R && s.x > 50 && !o.hit) {
          o.hit = true;
          transitDamage(s, 30, evs, 'trachee');
          evs.push({ type: 'fausseRoute' });
          s.x = 30; s.target = 30;
        }
        break;
      case 'acide':
      case 'bouchon':
        if (dy < o.h / 2 + R && s.x + R > o.x1 && s.x - R < o.x2) {
          if (o.kind === 'acide') {
            // Brûlure continue : la carapace fond tant qu'on reste dedans.
            if (s.shield > 0 || s.boost > 0) { if (!o.blocked) { o.blocked = true; evs.push({ type: 'bloque', cause: 'acide' }); } }
            else {
              s.carapace = Math.max(0, s.carapace - 45 * dt);
              if (!o.burning) { o.burning = true; evs.push({ type: 'degat', cause: 'acide', points: 0 }); }
              if (s.carapace <= 0) { s.over = true; s.phase = 'dead'; evs.push({ type: 'digere', cause: 'acide' }); }
            }
          } else if (!o.hit) {
            o.hit = true;
            transitDamage(s, 25, evs, 'bouchon');
          }
        }
        break;
      case 'pepsine':
        if (rond && !o.hit) { o.hit = true; transitDamage(s, 20, evs, 'pepsine'); }
        break;
      case 'anneau': {
        if (dy >= o.h / 2 + R || o.hit) break;
        o.hit = true;
        if (transitOpen(o, s.t) > 0.5) {
          // Anneau ouvert : la vague de péristaltisme te propulse.
          s.boost = Math.max(s.boost, 1.2);
          s.score += 10;
          evs.push({ type: 'vague', points: 10 });
        } else {
          transitDamage(s, 15, evs, 'anneau');
        }
        break;
      }
      case 'reflux':
        if (dy < o.h / 2 + R && s.x + R > o.x1 && s.x - R < o.x2) {
          // Remontée acide : elle annule la descente sans abîmer la carapace.
          s.y -= 34 * dt;
          if (!o.vu) { o.vu = true; evs.push({ type: 'reflux' }); }
        }
        break;
      case 'bile': {
        if (dy >= o.h / 2 + R) break;
        const jet = transitOpen(o, s.t) > 0.55;
        if (!jet) break;
        const wo = transitWalls(o.y, s.level);
        const atteint = o.cote === 'left'
          ? s.x - R < wo.left + (wo.right - wo.left) * o.portee
          : s.x + R > wo.right - (wo.right - wo.left) * o.portee;
        if (atteint && !o.hit) { o.hit = true; transitDamage(s, 20, evs, 'bile'); }
        break;
      }
      case 'vitamine':
        if (rond) { o.done = true; s.carapace = Math.min(TRANSIT.CARAPACE, s.carapace + 8); s.score += 15; evs.push({ type: 'bonus', kind: 'vitamine', points: 15 }); }
        break;
      case 'mechante':
        if (rond) { o.done = true; transitDamage(s, 20, evs, 'bacterie'); }
        break;
      case 'miette':
        if (rond) { o.done = true; s.score += 10; evs.push({ type: 'bonus', kind: 'miette', points: 10 }); }
        break;
      case 'bulle':
        if (rond) { o.done = true; s.carapace = Math.min(TRANSIT.CARAPACE, s.carapace + 12); s.score += 5; evs.push({ type: 'bonus', kind: 'bulle', points: 5 }); }
        break;
      case 'gentille':
        if (rond) { o.done = true; s.carapace = Math.min(TRANSIT.CARAPACE, s.carapace + 5); s.score += 15; evs.push({ type: 'bonus', kind: 'gentille', points: 15 }); }
        break;
      case 'gaz':
        if (rond) { o.done = true; s.boost = 2; s.score += 10; evs.push({ type: 'gaz', points: 10 }); }
        break;
    }
    if (s.over) return evs;
  }

  if (s.y >= niv.longueur) {
    const etoiles = transitStars(s.carapace);
    s.stars[s.level] = etoiles;
    s.lastLevelStars = etoiles;
    s.score += Math.round(s.carapace * 2) + etoiles * 50;
    evs.push({ type: 'niveau', level: s.level, stars: etoiles });
    if (s.level >= TRANSIT.NIVEAUX.length - 1) {
      s.phase = 'done';
      s.finished = true;
      s.over = true;
      // Arrivée : bonus final, plus gros si la carapace a tenu.
      s.score += 200 + Math.round(s.carapace * 3);
    } else {
      s.phase = 'clear';
    }
  }
  return evs;
}

/** Passe à l'organe suivant après l'écran « organe franchi ». */
function transitNextLevel(s) {
  if (s.phase !== 'clear') return false;
  s.level++;
  s.phase = 'intro';
  s.resumed = false;
  return true;
}

/** Sauvegarde à reprendre (début de l'organe en cours), ou null. */
function transitCheckpoint(s) {
  if (s.finished || !s.levelStart) return null;
  return { ...s.levelStart };
}

function transitResult(s) {
  return {
    score: Math.round(s.score),
    finished: s.finished,
    carapace: Math.round(s.carapace),
    level: s.level,
    stars: s.stars.reduce((a, b) => a + (b || 0), 0),
    splash: false,
  };
}

// ============================================================
//  RENDU
// ============================================================
function transitCreate(env) {
  const D = window.JeuxCore.JeuxDessin;
  const cp = env.getStats().transit?.checkpoint || null;
  const s = transitNew(cp);
  const flottants = [];
  let secousse = 0;
  let pouce = null;          // { x0, cible0 }
  let boutons = [];          // zones cliquables dessinées sur le canvas

  const k = () => env.W / 100;
  const ecranY = () => env.H * 0.3;

  function sauver(checkpoint) {
    const stats = env.getStats();
    stats.transit = { ...(stats.transit || {}), checkpoint };
    env.setStats(stats);
  }

  function commencerNiveau() {
    env.onStart?.();
    transitStartLevel(s, env.rng);
    sauver(transitCheckpoint(s));
    env.onScore(Math.round(s.score));
  }

  function grain(ctx, x, y, taille) {
    ctx.save();
    ctx.translate(x, y);
    if (s.shield > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, taille * 1.45, 0, Math.PI * 2); ctx.stroke();
    }
    if (s.boost > 0) D.emoji(ctx, '💨', 0, -taille * 1.8, taille * 1.3);
    const clignote = s.invuln > 0 && Math.floor(s.invuln * 12) % 2 === 0;
    ctx.globalAlpha = clignote ? 0.35 : 1;
    // Grain de maïs : goutte dorée, pointe en haut
    const grad = ctx.createLinearGradient(-taille, -taille, taille, taille);
    grad.addColorStop(0, '#fde047');
    grad.addColorStop(1, '#f59e0b');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -taille * 1.25);
    ctx.bezierCurveTo(taille * 1.2, -taille * 0.7, taille * 1.1, taille, 0, taille * 1.05);
    ctx.bezierCurveTo(-taille * 1.1, taille, -taille * 1.2, -taille * 0.7, 0, -taille * 1.25);
    ctx.fill(); ctx.stroke();
    // Usure de la carapace : taches brunes
    const usure = 1 - s.carapace / TRANSIT.CARAPACE;
    ctx.fillStyle = `rgba(120,53,15,${0.55 * usure})`;
    ctx.beginPath(); ctx.arc(taille * 0.4, taille * 0.3, taille * 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-taille * 0.35, -taille * 0.2, taille * 0.25, 0, Math.PI * 2); ctx.fill();
    // Visage
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-taille * 0.32, -taille * 0.05, taille * 0.24, 0, Math.PI * 2); ctx.arc(taille * 0.32, -taille * 0.05, taille * 0.24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1c1917';
    ctx.beginPath(); ctx.arc(-taille * 0.3, 0, taille * 0.12, 0, Math.PI * 2); ctx.arc(taille * 0.34, 0, taille * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1c1917'; ctx.lineWidth = 2;
    ctx.beginPath();
    if (s.carapace < 35) ctx.arc(0, taille * 0.6, taille * 0.22, Math.PI * 1.15, Math.PI * 1.85);
    else ctx.arc(0, taille * 0.35, taille * 0.25, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.restore();
  }

  function carte(ctx, titre, lignes, actions) {
    const W = env.W, H = env.H;
    ctx.fillStyle = 'rgba(15,23,42,.72)';
    ctx.fillRect(0, 0, W, H);
    const cw = Math.min(W - 32, 340);
    const cx = (W - cw) / 2;
    let y = H * 0.16;
    D.texte(ctx, titre, W / 2, y, { size: 26, color: '#fde68a' });
    y += 36;
    ctx.save();
    ctx.font = `600 15px ${D.police}`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lignes.forEach(ligne => {
      if (!ligne) { y += 10; return; }
      // Retour à la ligne manuel : le canvas ne sait pas couper le texte.
      const mots = ligne.split(' ');
      let cur = '';
      mots.forEach(m => {
        const essai = cur ? `${cur} ${m}` : m;
        if (ctx.measureText(essai).width > cw && cur) { ctx.fillText(cur, W / 2, y); y += 22; cur = m; }
        else cur = essai;
      });
      if (cur) { ctx.fillText(cur, W / 2, y); y += 22; }
    });
    ctx.restore();
    y += 18;
    boutons = actions.map((a, i) => {
      const bh = 50, by = y + i * (bh + 10);
      ctx.fillStyle = i === 0 ? '#fff' : 'rgba(255,255,255,.18)';
      D.rrect(ctx, cx, by, cw, bh, 25); ctx.fill();
      D.texte(ctx, a.label, W / 2, by + bh / 2, { size: 17, color: i === 0 ? '#4c1d95' : '#fff' });
      return { x: cx, y: by, w: cw, h: bh, act: a.act };
    });
  }

  function heure(h) {
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    return `${hh} h ${String(mm).padStart(2, '0')}`;
  }

  function agir(act) {
    if (act === 'go') { commencerNiveau(); env.haptic(8); }
    else if (act === 'restart') {
      sauver(null);
      Object.assign(s, transitNew(null));
      env.onScore(0);
      env.haptic(8);
    } else if (act === 'next') { transitNextLevel(s); env.haptic(8); }
  }

  return {
    // Le jeu affiche lui-meme son ecran d'organe avant chaque niveau.
    noReady: true,
    hint: 'Glisse le pouce pour bouger, tape pour durcir ta carapace',
    drag(x, y, etape) {
      if (s.phase !== 'play') return;
      if (etape === 'start') pouce = { x0: x, cible0: s.target };
      else if (etape === 'move' && pouce) transitSetTarget(s, pouce.cible0 + ((x - pouce.x0) / k()) * 1.2);
      else if (etape === 'end') pouce = null;
    },
    swipe(dir) {
      if (s.phase !== 'play') return;
      if (dir === 'left') transitSetTarget(s, s.target - 12);
      if (dir === 'right') transitSetTarget(s, s.target + 12);
    },
    tap(x, y) {
      if (s.phase === 'play') { if (transitShield(s)) env.haptic([6, 20, 6]); return; }
      const b = boutons.find(z => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
      if (b) agir(b.act);
      else if (boutons.length === 1) agir(boutons[0].act);
    },
    update(dt) {
      const evs = transitStep(s, dt);
      evs.forEach(ev => {
        const px = s.x * k(), py = ecranY();
        if (ev.type === 'degat') {
          env.haptic(ev.cause === 'acide' ? 15 : [25, 30, 25]);
          secousse = env.reduceMotion ? 0 : 0.3;
          const txt = { machoire: 'CRONCH !', trachee: 'Fausse route !', cardia: 'Cardia fermé !', pylore: 'Pylore fermé !', valvule: 'Valvule fermée !', sphincter: 'Sphincter fermé !', acide: 'Ça brûle !', pepsine: 'Coupé !', bacterie: 'Attaque !', bouchon: 'Bouché !', anneau: 'Serré !', bile: 'Jet de bile !' }[ev.cause] || 'Aïe !';
          flottants.push({ txt, x: px, y: py - 40, t: 0, color: '#fecaca', size: 22 });
        }
        if (ev.type === 'bloque') flottants.push({ txt: 'Paré !', x: px, y: py - 40, t: 0, color: '#e0f2fe' });
        if (ev.type === 'bonus') { env.haptic(6); flottants.push({ txt: ev.kind === 'bulle' ? '+ carapace' : `+${ev.points}`, x: px, y: py - 40, t: 0, color: '#fef9c3' }); }
        if (ev.type === 'gaz') { env.haptic([10, 10, 10]); flottants.push({ txt: 'Propulsion !', x: px, y: py - 40, t: 0, color: '#bbf7d0', size: 24 }); }
        if (ev.type === 'vague') { env.haptic([8, 12, 8]); flottants.push({ txt: 'Vague ! +10', x: px, y: py - 40, t: 0, color: '#fbcfe8', size: 24 }); }
        if (ev.type === 'reflux') flottants.push({ txt: 'Ça remonte !', x: px, y: py - 40, t: 0, color: '#d9f99d' });
        if (ev.type === 'aspire') flottants.push({ txt: 'Aspiration !', x: px, y: py - 40, t: 0, color: '#fbcfe8' });
        if (ev.type === 'niveau') {
          env.haptic([10, 40, 10, 40, 10]);
          if (!s.finished) sauver({ level: s.level + 1, carapace: s.carapace, score: s.score, stars: [...s.stars] });
        }
      });
      if (evs.length) env.onScore(Math.round(s.score));
      if (s.finished && s.phase === 'done' && !s.reported) {
        s.reported = true;
        sauver(null);
        env.onOver(transitResult(s));
      } else if (s.phase === 'dead' && !s.reported) {
        s.reported = true;
        env.onOver(transitResult(s));
      }
    },
    draw(dt) {
      const ctx = env.ctx, W = env.W, H = env.H;
      const niv = transitLevel(s) || TRANSIT.NIVEAUX[TRANSIT.NIVEAUX.length - 1];
      const u = k(), camY = s.y - ecranY() / u;
      ctx.save();
      if (secousse > 0) { secousse = Math.max(0, secousse - dt); ctx.translate((env.rng() - 0.5) * 12 * secousse, 0); }

      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, niv.fond[0]);
      grad.addColorStop(1, niv.fond[1]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Parois du tube
      const vueH = H / u;
      ctx.fillStyle = niv.paroi;
      for (const cote of ['left', 'right']) {
        ctx.beginPath();
        ctx.moveTo(cote === 'left' ? 0 : W, 0);
        for (let yy = 0; yy <= vueH + 4; yy += 4) {
          const w = transitWalls(camY + yy, s.level);
          ctx.lineTo(w[cote] * u, yy * u);
        }
        ctx.lineTo(cote === 'left' ? 0 : W, H);
        ctx.closePath();
        ctx.fill();
      }

      // Objets visibles
      for (const o of s.objets) {
        if (o.done) continue;
        const sy = (o.y - camY) * u;
        if (sy < -60 || sy > H + 60) continue;
        if (o.kind === 'machoire' || o.kind === 'porte') {
          const half = transitGapHalf(o, s.t);
          const w = transitWalls(o.y, s.level);
          const hh = o.h * u;
          ctx.fillStyle = o.kind === 'machoire' ? '#f8fafc' : '#9f1239';
          ctx.strokeStyle = o.kind === 'machoire' ? '#cbd5e1' : '#4c0519';
          ctx.lineWidth = 2;
          D.rrect(ctx, w.left * u - 10, sy - hh / 2, (o.x - half - w.left) * u + 10, hh, 8); ctx.fill(); ctx.stroke();
          D.rrect(ctx, (o.x + half) * u, sy - hh / 2, (w.right - o.x - half) * u + 10, hh, 8); ctx.fill(); ctx.stroke();
          if (o.kind === 'porte') D.texte(ctx, o.nom === 'pylore' ? 'PYLORE' : 'SORTIE', W / 2, sy - hh / 2 - 12, { size: 13, color: '#fff' });
        } else if (o.kind === 'anneau') {
          // Anneau musculaire : il se referme sur toute la largeur.
          const ouvert = transitOpen(o, s.t);
          const w = transitWalls(o.y, s.level);
          const demi = ((w.right - w.left) / 2) * (0.12 + 0.88 * ouvert);
          const hh = o.h * u, centre = (w.left + w.right) / 2;
          ctx.fillStyle = ouvert > 0.5 ? '#f472b6' : '#9f1239';
          ctx.strokeStyle = '#831843';
          ctx.lineWidth = 2;
          D.rrect(ctx, w.left * u - 10, sy - hh / 2, (centre - demi - w.left) * u + 10, hh, 10); ctx.fill(); ctx.stroke();
          D.rrect(ctx, (centre + demi) * u, sy - hh / 2, (w.right - centre - demi) * u + 10, hh, 10); ctx.fill(); ctx.stroke();
          if (ouvert > 0.5) D.texte(ctx, '▼ vague', centre * u, sy, { size: 12, color: '#fff' });
        } else if (o.kind === 'reflux') {
          ctx.fillStyle = 'rgba(190,242,100,.35)';
          D.rrect(ctx, o.x1 * u, sy - (o.h * u) / 2, (o.x2 - o.x1) * u, o.h * u, 12); ctx.fill();
          ctx.fillStyle = 'rgba(236,252,203,.9)';
          for (let i = 0; i < 4; i++) {
            const bx = (o.x1 + (o.x2 - o.x1) * (0.15 + i * 0.25)) * u;
            const by = sy + ((s.t * 40 + i * 30) % (o.h * u)) - (o.h * u) / 2;
            ctx.beginPath(); ctx.arc(bx, by, 4, 0, Math.PI * 2); ctx.fill();
          }
          D.texte(ctx, '↑', (o.x1 + o.x2) / 2 * u, sy, { size: 18, color: '#3f6212' });
        } else if (o.kind === 'villosite') {
          // Frange de doigts le long d'une paroi, qui ondule et aspire.
          const hh = o.h * u;
          ctx.fillStyle = '#f9a8d4';
          for (let i = 0; i <= 6; i++) {
            const yy = sy - hh / 2 + (hh / 6) * i;
            const w = transitWalls(o.y - o.h / 2 + (o.h / 6) * i, s.level);
            const base = (o.cote === 'left' ? w.left : w.right) * u;
            const sens = o.cote === 'left' ? 1 : -1;
            const lg = (9 + Math.sin(s.t * 3 + i) * 3) * u;
            D.rrect(ctx, o.cote === 'left' ? base : base - lg, yy - 4, lg, 8, 4);
            ctx.fill();
          }
        } else if (o.kind === 'bile') {
          const w = transitWalls(o.y, s.level);
          const actif = transitOpen(o, s.t) > 0.55;
          const lg = (w.right - w.left) * o.portee * u;
          const base = (o.cote === 'left' ? w.left : w.right) * u;
          ctx.fillStyle = '#65a30d';
          ctx.beginPath(); ctx.arc(base, sy, 6, 0, Math.PI * 2); ctx.fill();
          if (actif) {
            ctx.fillStyle = 'rgba(250,204,21,.85)';
            D.rrect(ctx, o.cote === 'left' ? base : base - lg, sy - (o.h * u) / 2, lg, o.h * u, 6);
            ctx.fill();
          }
        } else if (o.kind === 'epiglotte') {
          ctx.fillStyle = 'rgba(255,255,255,.2)';
          ctx.fillRect(50 * u, sy - 60, W / 2, 120);
          ctx.fillStyle = '#9f1239';
          ctx.fillRect(50 * u - 3, sy - 70, 6, 140);
          D.texte(ctx, '← Œsophage', 25 * u, sy - 80, { size: 14, color: '#fff' });
          D.texte(ctx, 'Trachée ✕', 75 * u, sy - 80, { size: 14, color: '#fecaca' });
        } else if (o.kind === 'acide' || o.kind === 'bouchon') {
          ctx.fillStyle = o.kind === 'acide' ? 'rgba(163,230,53,.8)' : '#57534e';
          D.rrect(ctx, o.x1 * u, sy - (o.h * u) / 2, (o.x2 - o.x1) * u, o.h * u, 10); ctx.fill();
          if (o.kind === 'acide') {
            ctx.fillStyle = 'rgba(236,252,203,.8)';
            for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc((o.x1 + (o.x2 - o.x1) * (0.2 + i * 0.3)) * u, sy + Math.sin(s.t * 4 + i) * 4, 3, 0, Math.PI * 2); ctx.fill(); }
          }
        } else if (o.kind === 'bulle') {
          ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.fillStyle = 'rgba(186,230,253,.45)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(o.x * u, sy, o.r * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        } else if (o.kind === 'gentille') {
          ctx.fillStyle = '#4ade80';
          ctx.beginPath(); ctx.arc(o.x * u, sy, o.r * u, 0, Math.PI * 2); ctx.fill();
          D.texte(ctx, '˘‿˘', o.x * u, sy, { size: o.r * u * 0.9, color: '#14532d' });
        } else {
          const emo = { miette: '🍞', pepsine: '✂️', mechante: '🦠', gaz: '💨', vitamine: '💊' }[o.kind];
          if (emo) D.emoji(ctx, emo, o.x * u, sy, (o.r || 4) * u * 2.1);
        }
      }

      if (s.phase === 'play' || s.phase === 'dead' || s.phase === 'done') grain(ctx, s.x * u, ecranY(), TRANSIT.RAYON * u);
      D.flotter(ctx, flottants, dt);

      // Interface : carapace, horloge du transit, bouclier
      const jw = W - 32;
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      D.rrect(ctx, 16, 14, jw, 16, 8); ctx.fill();
      ctx.fillStyle = s.carapace > 60 ? '#facc15' : s.carapace > 30 ? '#f97316' : '#dc2626';
      D.rrect(ctx, 16, 14, Math.max(16, jw * s.carapace / TRANSIT.CARAPACE), 16, 8); ctx.fill();
      D.texte(ctx, `Carapace ${Math.round(s.carapace)} %`, W / 2, 22, { size: 11, color: '#1c1917' });
      D.texte(ctx, `${niv.emoji} ${niv.nom}`, 16, 46, { size: 14, align: 'left', color: '#fff' });
      D.texte(ctx, `⏱ ${heure(transitClock(s))}`, W - 16, 46, { size: 14, align: 'right', color: '#fff' });
      if (s.phase === 'play') {
        D.texte(ctx, s.recharge > 0 ? `🛡 ${s.recharge.toFixed(1)} s` : '🛡 prêt : tape', W - 16, H - 16, { size: 13, align: 'right', color: '#fff' });
        const p = Math.min(1, s.y / niv.longueur);
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        ctx.fillRect(8, 60, 4, H - 100);
        ctx.fillStyle = '#fff';
        ctx.fillRect(8, 60, 4, (H - 100) * p);
      }
      ctx.restore();

      // Écrans d'organe
      boutons = [];
      if (s.phase === 'intro') {
        const actions = s.resumed
          ? [{ label: `Reprendre : ${niv.nom.toLowerCase()}`, act: 'go' }, { label: 'Recommencer depuis la bouche', act: 'restart' }]
          : [{ label: s.level === 0 ? 'Se faire croquer' : `Entrer dans ${niv.nom.toLowerCase()}`, act: 'go' }];
        carte(ctx, `${niv.emoji} ${niv.nom}`, [
          `Transit : ${heure(niv.heures[0])}`,
          '',
          niv.intro,
          '',
          'Glisse le pouce pour bouger. Tape pour durcir ta carapace.',
        ], actions);
      } else if (s.phase === 'clear') {
        carte(ctx, `${'★'.repeat(s.lastLevelStars)}${'☆'.repeat(3 - s.lastLevelStars)}`, [
          `${niv.nom} franchi en ${heure(niv.heures[1])} de transit.`,
          `Carapace : ${Math.round(s.carapace)} %`,
          '',
          `Le savais-tu ? ${niv.anecdote}`,
        ], [{ label: 'Continuer le voyage', act: 'next' }]);
      }
    },
  };
}

window.JeuTransit = {
  TRANSIT, transitWalls, transitOpen, transitGapHalf, transitBuildLevel, transitNew, transitStartLevel,
  transitClock, transitSetTarget, transitShield, transitSpeed, transitStars, transitStep, transitNextLevel,
  transitCheckpoint, transitResult, create: transitCreate,
};
