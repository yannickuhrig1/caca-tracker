// ============================================================
//  plop.js — Plop! 🚽
//  La cuvette glisse de gauche à droite, on tape pour lâcher le caca.
//  Plein centre : « Plop parfait », sur le bord : ça passe, à côté :
//  éclaboussure (3 rouleaux de vie). Tout accélère au fil des plops.
//  Logique pure testée : test/jeux-arcade.test.js
// ============================================================

const PLOP = {
  VIES: 3,
  GRAVITE: 3.2,          // en hauteurs d'écran par seconde²
  VITESSE_INIT: 0.34,    // en largeurs d'écran par seconde
  VITESSE_MAX: 1.35,
  DEMI_LARGEUR_INIT: 0.16,
  DEMI_LARGEUR_MIN: 0.07,
  PARFAIT: 0.22,         // part de la demi-largeur qui compte comme centre
};

function plopNew() {
  return {
    bowlX: 0.5, bowlDir: 1, speed: PLOP.VITESSE_INIT, halfW: PLOP.DEMI_LARGEUR_INIT,
    drop: null, score: 0, lives: PLOP.VIES, streak: 0, bestStreak: 0, plops: 0, splashes: 0, over: false,
  };
}

/** 'perfect' | 'ok' | 'miss' selon l'écart horizontal au centre de la cuvette. */
function plopJudge(dx, halfW) {
  const r = Math.abs(dx) / halfW;
  if (r <= PLOP.PARFAIT) return 'perfect';
  if (r <= 1) return 'ok';
  return 'miss';
}

/** Lâcher : un seul caca à la fois. */
function plopDrop(s) {
  if (s.over || s.drop) return false;
  s.drop = { x: 0.5, y: 0, vy: 0 };
  return true;
}

/**
 * Avance le jeu de `dt` secondes. Rend l'événement du pas, s'il y en a un :
 * { type: 'perfect' | 'ok' | 'miss', gain, x } ou null.
 * `rng` : la cuvette change parfois d'allure en rebondissant.
 */
function plopStep(s, dt, rng = Math.random) {
  if (s.over) return null;
  s.bowlX += s.bowlDir * s.speed * dt;
  const mini = s.halfW, maxi = 1 - s.halfW;
  if (s.bowlX < mini || s.bowlX > maxi) {
    s.bowlX = Math.min(maxi, Math.max(mini, s.bowlX));
    s.bowlDir *= -1;
    // Après 5 plops, la cuvette devient imprévisible : ±20 % à chaque rebond.
    if (s.plops >= 5) s.speed = Math.min(PLOP.VITESSE_MAX, Math.max(PLOP.VITESSE_INIT, s.speed * (0.8 + rng() * 0.4)));
  }
  if (!s.drop) return null;

  s.drop.vy += PLOP.GRAVITE * dt;
  s.drop.y += s.drop.vy * dt;
  if (s.drop.y < 1) return null;

  const x = s.drop.x;
  const type = plopJudge(x - s.bowlX, s.halfW);
  s.drop = null;
  let gain = 0;
  if (type === 'miss') {
    s.lives--;
    s.streak = 0;
    s.splashes++;
    if (s.lives <= 0) s.over = true;
  } else {
    s.plops++;
    if (type === 'perfect') {
      gain = 3 + Math.min(s.streak, 5);
      s.streak++;
      s.bestStreak = Math.max(s.bestStreak, s.streak);
    } else {
      gain = 1;
      s.streak = 0;
    }
    s.score += gain;
    s.speed = Math.min(PLOP.VITESSE_MAX, s.speed * 1.07);
    s.halfW = Math.max(PLOP.DEMI_LARGEUR_MIN, s.halfW * 0.97);
  }
  return { type, gain, x };
}

function plopCreate(env) {
  const D = window.JeuxCore.JeuxDessin;
  const s = plopNew();
  const flottants = [];
  const gouttes = [];
  let secousse = 0;

  function geo() {
    const W = env.W, H = env.H;
    return { W, H, top: 90, rim: H - 150 };
  }

  return {
    hint: 'Tape n\'importe où pour lâcher 💩',
    tap() { if (plopDrop(s)) env.haptic(6); },
    update(dt) {
      const ev = plopStep(s, dt, env.rng);
      if (!ev) return;
      const { W, rim } = geo();
      const px = ev.x * W;
      if (ev.type === 'miss') {
        env.haptic([30, 30, 60]);
        secousse = env.reduceMotion ? 0 : 0.35;
        for (let i = 0; i < 14; i++) gouttes.push({ x: px, y: rim, vx: (env.rng() - 0.5) * 320, vy: -120 - env.rng() * 260, t: 0 });
        flottants.push({ txt: 'SPLASH !', x: px, y: rim - 40, t: 0, color: '#fca5a5', size: 26 });
      } else {
        env.haptic(ev.type === 'perfect' ? [10, 20, 10] : 10);
        flottants.push({ txt: ev.type === 'perfect' ? `PARFAIT ! +${ev.gain}` : '+1', x: px, y: rim - 50, t: 0, color: ev.type === 'perfect' ? '#fde047' : '#fff', size: ev.type === 'perfect' ? 28 : 22 });
      }
      env.onScore(s.score);
      if (s.over) env.onOver({ score: s.score, perfectStreak: s.bestStreak, splash: s.splashes > 0 });
    },
    draw(dt) {
      const ctx = env.ctx;
      const { W, H, top, rim } = geo();
      ctx.save();
      if (secousse > 0) {
        secousse = Math.max(0, secousse - dt);
        ctx.translate((env.rng() - 0.5) * 14 * secousse, 0);
      }
      // Carrelage de salle de bain
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(14,116,144,.12)';
      ctx.lineWidth = 2;
      for (let x = 0; x < W; x += 44) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 44) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // Guide de visée : ligne de chute
      ctx.setLineDash([6, 10]);
      ctx.strokeStyle = 'rgba(15,23,42,.18)';
      ctx.beginPath(); ctx.moveTo(W / 2, top + 30); ctx.lineTo(W / 2, rim); ctx.stroke();
      ctx.setLineDash([]);

      // Cuvette
      const bx = s.bowlX * W, bw = s.halfW * W;
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      D.rrect(ctx, bx - bw * 0.55, rim + 18, bw * 1.1, 70, 14); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(bx, rim, bw, 26, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7dd3fc';
      ctx.beginPath(); ctx.ellipse(bx, rim + 3, bw * 0.78, 17, 0, 0, Math.PI * 2); ctx.fill();
      // Zone parfaite
      ctx.fillStyle = 'rgba(250,204,21,.55)';
      ctx.beginPath(); ctx.ellipse(bx, rim + 3, Math.max(4, bw * PLOP.PARFAIT), 9, 0, 0, Math.PI * 2); ctx.fill();

      // Caca en attente ou en chute
      const py = s.drop ? top + s.drop.y * (rim - top) : top;
      D.emoji(ctx, '💩', W / 2, py, 46);

      // Éclaboussures
      for (let i = gouttes.length - 1; i >= 0; i--) {
        const g = gouttes[i];
        g.t += dt; g.vy += 700 * dt; g.x += g.vx * dt; g.y += g.vy * dt;
        if (g.t > 1.2) { gouttes.splice(i, 1); continue; }
        ctx.fillStyle = `rgba(146,64,14,${1 - g.t / 1.2})`;
        ctx.beginPath(); ctx.arc(g.x, g.y, 5, 0, Math.PI * 2); ctx.fill();
      }
      D.flotter(ctx, flottants, dt);

      // Vies et série
      D.texte(ctx, '🧻'.repeat(Math.max(0, s.lives)) + '·'.repeat(PLOP.VIES - Math.max(0, s.lives)), 16, 30, { size: 24, align: 'left', color: '#0f172a' });
      if (s.streak >= 2) D.texte(ctx, `🔥 x${s.streak}`, W - 16, 30, { size: 22, align: 'right', color: '#b45309' });
      ctx.restore();
    },
  };
}

window.JeuPlop = { PLOP, plopNew, plopJudge, plopDrop, plopStep, create: plopCreate };
