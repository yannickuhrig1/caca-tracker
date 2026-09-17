// ============================================================
//  course.js — Course au trône 🏃‍♀️
//  Un runner : tape pour sauter par-dessus la porte fermée, la file
//  d'attente et le panneau « Hors service ». La jauge d'urgence monte ;
//  attraper des toilettes 🚽 la vide, un rouleau 🧻 rapporte des mètres.
//  Jauge pleine : accident, fin de la course.
//  Unités du monde : le sol est à y = 0, l'héroïne mesure 14 de haut.
//  Logique pure testée : test/jeux-arcade.test.js
// ============================================================

const COURSE = {
  JOUEUSE_X: 18, JOUEUSE_W: 9, JOUEUSE_H: 14,
  SAUT: 98, GRAVITE: 270,
  VITESSE_INIT: 58, VITESSE_MAX: 115, ACCELERATION: 1.6,   // unités/s, unités/s²
  URGENCE_BASE: 3.6,     // points par seconde (jauge sur 100)
  METRE: 10,             // unités par mètre
  BONUS_PQ: 10, BONUS_WC: 25,
  OBSTACLES: {
    porte:  { w: 7,  h: 13, emoji: '🚪', label: 'Porte fermée' },
    file:   { w: 17, h: 8,  emoji: '🧍', label: 'File d\'attente' },
    panneau:{ w: 6,  h: 11, emoji: '🚧', label: 'Hors service' },
  },
};

function courseNew() {
  return {
    t: 0, dist: 0, bonus: 0, speed: COURSE.VITESSE_INIT, py: 0, vy: 0,
    obstacles: [], pickups: [], urgence: 0, prochain: 70, over: false, reason: null, wcTaken: 0,
  };
}

function courseScore(s) { return Math.floor(s.dist / COURSE.METRE) + s.bonus; }

function courseJump(s) {
  if (s.over || s.py > 0.01) return false;
  s.vy = COURSE.SAUT;
  return true;
}

function courseHit(a, b, marge = 1.2) {
  return a.x + marge < b.x + b.w && a.x + a.w - marge > b.x && a.y + marge < b.y + b.h && a.y + a.h - marge > b.y;
}

/** Fait apparaître le prochain obstacle (et parfois un bonus) au bord droit. */
function courseSpawn(s, viewW, rng = Math.random) {
  const kinds = Object.keys(COURSE.OBSTACLES);
  const kind = kinds[Math.floor(rng() * kinds.length)];
  const o = COURSE.OBSTACLES[kind];
  const x = viewW + 10;
  s.obstacles.push({ kind, x, y: 0, w: o.w, h: o.h });
  // Écart suivant : jamais moins qu'un saut complet à la vitesse actuelle.
  const tempsSaut = (2 * COURSE.SAUT) / COURSE.GRAVITE;
  s.prochain = s.speed * tempsSaut * 1.15 + o.w + rng() * 80;
  // Un bonus flotte parfois entre deux obstacles, en hauteur ou au sol.
  const r = rng();
  if (r < 0.45) {
    const wc = s.urgence > 45 && r < 0.3;
    s.pickups.push({ kind: wc ? 'wc' : 'pq', x: x + s.prochain / 2, y: rng() < 0.5 ? 2 : 20, w: 8, h: 8 });
  }
}

/** Avance de `dt` secondes. Rend les événements : 'pq' | 'wc' | 'obstacle' | 'accident'. */
function courseStep(s, dt, viewW = 200, rng = Math.random) {
  if (s.over) return [];
  const evs = [];
  s.t += dt;
  s.speed = Math.min(COURSE.VITESSE_MAX, s.speed + COURSE.ACCELERATION * dt);
  const dx = s.speed * dt;
  s.dist += dx;

  // Saut
  if (s.py > 0 || s.vy > 0) {
    s.vy -= COURSE.GRAVITE * dt;
    s.py = Math.max(0, s.py + s.vy * dt);
    if (s.py === 0) s.vy = 0;
  }

  s.obstacles.forEach(o => { o.x -= dx; });
  s.pickups.forEach(p => { p.x -= dx; });
  s.obstacles = s.obstacles.filter(o => o.x + o.w > -20);
  s.pickups = s.pickups.filter(p => p.x + p.w > -20);
  s.prochain -= dx;
  if (s.prochain <= 0) courseSpawn(s, viewW, rng);

  // La jauge monte un peu plus vite à mesure que la course dure.
  s.urgence = Math.min(100, s.urgence + (COURSE.URGENCE_BASE + s.dist / 6000) * dt);

  const moi = { x: COURSE.JOUEUSE_X, y: s.py, w: COURSE.JOUEUSE_W, h: COURSE.JOUEUSE_H };
  for (let i = s.pickups.length - 1; i >= 0; i--) {
    const p = s.pickups[i];
    if (!courseHit(moi, p, 0)) continue;
    s.pickups.splice(i, 1);
    if (p.kind === 'wc') { s.urgence = 0; s.bonus += COURSE.BONUS_WC; s.wcTaken++; }
    else s.bonus += COURSE.BONUS_PQ;
    evs.push(p.kind);
  }
  if (s.obstacles.some(o => courseHit(moi, o))) {
    s.over = true; s.reason = 'obstacle'; evs.push('obstacle');
  } else if (s.urgence >= 100) {
    s.over = true; s.reason = 'accident'; evs.push('accident');
  }
  return evs;
}

function courseCreate(env) {
  const D = window.JeuxCore.JeuxDessin;
  const s = courseNew();
  const flottants = [];

  function echelle() {
    // 90 unités visibles en largeur : en portrait, l'héroïne reste assez grande
    // et on voit arriver les obstacles un peu plus d'une demi-seconde à l'avance.
    const k = Math.min(env.H / 90, env.W / 90);
    return { k, sol: env.H - 70, viewW: env.W / k };
  }

  return {
    hint: 'Tape pour sauter 🦘',
    tap() { if (courseJump(s)) env.haptic(5); },
    update(dt) {
      const { k, sol, viewW } = echelle();
      const avant = courseScore(s);
      const evs = courseStep(s, dt, viewW, env.rng);
      const px = COURSE.JOUEUSE_X * k, py = sol - (s.py + COURSE.JOUEUSE_H) * k;
      evs.forEach(ev => {
        if (ev === 'pq') { env.haptic(8); flottants.push({ txt: `+${COURSE.BONUS_PQ} m`, x: px + 40, y: py, t: 0, color: '#fef9c3' }); }
        if (ev === 'wc') { env.haptic([10, 20, 10]); flottants.push({ txt: 'Ouf ! Jauge vidée', x: px + 70, y: py, t: 0, color: '#bbf7d0', size: 20 }); }
        if (ev === 'obstacle' || ev === 'accident') env.haptic([40, 30, 90]);
      });
      if (courseScore(s) !== avant) env.onScore(courseScore(s));
      if (s.over) env.onOver({ score: courseScore(s), distance: courseScore(s), reason: s.reason, splash: s.reason === 'accident' });
    },
    draw(dt) {
      const ctx = env.ctx, W = env.W, H = env.H;
      const { k, sol } = echelle();
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#fef3c7');
      grad.addColorStop(1, '#fde68a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Couloir qui défile : portes de cabines en fond
      const decal = (s.dist * k * 0.4) % 120;
      ctx.fillStyle = 'rgba(180,83,9,.12)';
      for (let x = -decal; x < W + 120; x += 120) { D.rrect(ctx, x + 20, sol - 150, 70, 150, 8); ctx.fill(); }
      ctx.fillStyle = '#92400e';
      ctx.fillRect(0, sol, W, H - sol);
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      const decalSol = (s.dist * k) % 40;
      for (let x = -decalSol; x < W; x += 40) ctx.fillRect(x, sol + 6, 20, 4);

      s.pickups.forEach(p => D.emoji(ctx, p.kind === 'wc' ? '🚽' : '🧻', (p.x + p.w / 2) * k, sol - (p.y + p.h / 2) * k, p.h * k * 1.2));
      s.obstacles.forEach(o => {
        const meta = COURSE.OBSTACLES[o.kind];
        const x = o.x * k, w = o.w * k, h = o.h * k;
        if (o.kind === 'porte') {
          ctx.fillStyle = '#78350f'; D.rrect(ctx, x, sol - h, w, h, 4); ctx.fill();
          ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(x + w * 0.75, sol - h * 0.5, Math.max(2, w * 0.12), 0, Math.PI * 2); ctx.fill();
        } else if (o.kind === 'file') {
          // Deux personnes qui attendent, légèrement décalées
          D.emoji(ctx, meta.emoji, x + w * 0.28, sol - h * 0.75, h * 1.6);
          D.emoji(ctx, meta.emoji, x + w * 0.72, sol - h * 0.7, h * 1.5);
        } else {
          D.emoji(ctx, meta.emoji, x + w / 2, sol - h / 2, h * 1.3);
        }
      });

      // L'héroïne : un caca qui court (petits sautillements au sol)
      const rebond = s.py > 0 || env.reduceMotion ? 0 : Math.abs(Math.sin(s.t * 14)) * 3;
      D.emoji(ctx, s.reason === 'accident' ? '😱' : '💩', (COURSE.JOUEUSE_X + COURSE.JOUEUSE_W / 2) * k, sol - (s.py + COURSE.JOUEUSE_H / 2) * k - rebond, COURSE.JOUEUSE_H * k * 1.05);

      // Jauge d'urgence
      const jw = W - 32;
      ctx.fillStyle = 'rgba(0,0,0,.15)';
      D.rrect(ctx, 16, 16, jw, 16, 8); ctx.fill();
      ctx.fillStyle = s.urgence > 75 ? '#dc2626' : s.urgence > 45 ? '#f97316' : '#16a34a';
      D.rrect(ctx, 16, 16, Math.max(16, jw * s.urgence / 100), 16, 8); ctx.fill();
      D.texte(ctx, s.urgence > 75 ? 'URGENCE !!' : 'Urgence', W / 2, 24, { size: 12, color: '#fff' });
      D.texte(ctx, `${courseScore(s)} m`, W / 2, 62, { size: 34, color: '#78350f' });
      D.flotter(ctx, flottants, dt);
    },
  };
}

window.JeuCourse = { COURSE, courseNew, courseScore, courseJump, courseHit, courseSpawn, courseStep, create: courseCreate };
