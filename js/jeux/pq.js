// ============================================================
//  pq.js — Tour de PQ 🧻
//  Un rouleau passe en balancier au-dessus de la pile ; on tape pour le
//  poser. Ce qui dépasse tombe. Trois poses parfaites d'affilée font
//  regagner un peu de largeur. Coordonnées en « unités » : largeur 100.
//  Logique pure testée : test/jeux-arcade.test.js
// ============================================================

const PQ = {
  LARGEUR: 100,
  ROULEAU_INIT: 60,
  TOLERANCE: 2.5,        // écart toléré pour une pose parfaite
  BONUS_LARGEUR: 5,      // regagné après 3 parfaites d'affilée
  VITESSE_INIT: 42,
  VITESSE_MAX: 120,
};

function pqNew() {
  const base = { x: (PQ.LARGEUR - PQ.ROULEAU_INIT) / 2, w: PQ.ROULEAU_INIT };
  return { stack: [base], cur: { x: 0, w: base.w, dir: 1 }, speed: PQ.VITESSE_INIT, perfectStreak: 0, bestPerfect: 0, over: false };
}

function pqHeight(s) { return s.stack.length - 1; }

function pqStep(s, dt) {
  if (s.over) return;
  const c = s.cur;
  c.x += c.dir * s.speed * dt;
  // Le rouleau dépasse un peu des bords : sinon viser devient trop facile.
  const mini = -c.w * 0.35, maxi = PQ.LARGEUR - c.w * 0.65;
  if (c.x < mini) { c.x = mini; c.dir = 1; }
  if (c.x > maxi) { c.x = maxi; c.dir = -1; }
}

/**
 * Pose le rouleau courant. Rend { type: 'perfect' | 'place' | 'over', cut }
 * où `cut` est le morceau qui tombe ({ x, w }) ou null.
 */
function pqPlace(s) {
  if (s.over) return { type: 'over', cut: null };
  const top = s.stack[s.stack.length - 1];
  const c = s.cur;
  const gauche = Math.max(c.x, top.x);
  const droite = Math.min(c.x + c.w, top.x + top.w);
  const recouvre = droite - gauche;

  if (recouvre <= 0) {
    s.over = true;
    return { type: 'over', cut: { x: c.x, w: c.w } };
  }

  let pose, cut = null, type;
  if (Math.abs(c.x - top.x) <= PQ.TOLERANCE) {
    s.perfectStreak++;
    s.bestPerfect = Math.max(s.bestPerfect, s.perfectStreak);
    let w = top.w;
    if (s.perfectStreak % 3 === 0) w = Math.min(PQ.ROULEAU_INIT, w + PQ.BONUS_LARGEUR);
    pose = { x: Math.max(0, Math.min(PQ.LARGEUR - w, top.x - (w - top.w) / 2)), w };
    type = 'perfect';
  } else {
    s.perfectStreak = 0;
    pose = { x: gauche, w: recouvre };
    cut = c.x < top.x ? { x: c.x, w: top.x - c.x } : { x: droite, w: c.x + c.w - droite };
    type = 'place';
  }
  s.stack.push(pose);

  const h = pqHeight(s);
  s.speed = Math.min(PQ.VITESSE_MAX, PQ.VITESSE_INIT + h * 1.6);
  const depuisGauche = h % 2 === 0;
  s.cur = { x: depuisGauche ? -pose.w * 0.35 : PQ.LARGEUR - pose.w * 0.65, w: pose.w, dir: depuisGauche ? 1 : -1 };
  return { type, cut };
}

function pqCreate(env) {
  const D = window.JeuxCore.JeuxDessin;
  const s = pqNew();
  const chutes = [];
  const flottants = [];
  let camera = 0;

  const HAUTEUR = 30;

  function rouleau(ctx, x, y, w, h, teinte = '#fff') {
    ctx.fillStyle = teinte;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    D.rrect(ctx, x, y, w, h, 8); ctx.fill(); ctx.stroke();
    // Pointillés prédécoupés
    ctx.strokeStyle = 'rgba(148,163,184,.55)';
    ctx.setLineDash([3, 5]);
    for (let px = x + 18; px < x + w - 8; px += 22) { ctx.beginPath(); ctx.moveTo(px, y + 5); ctx.lineTo(px, y + h - 5); ctx.stroke(); }
    ctx.setLineDash([]);
  }

  return {
    hint: 'Tape pour poser le rouleau 🧻',
    tap() {
      const top = s.stack[s.stack.length - 1];
      const ev = pqPlace(s);
      const u = env.W / PQ.LARGEUR;
      if (ev.cut) chutes.push({ x: ev.cut.x * u, w: ev.cut.w * u, y: 0, level: s.stack.length + (ev.type === 'over' ? 1 : 0), vy: 0, rot: 0 });
      if (ev.type === 'over') {
        env.haptic([30, 40, 80]);
        env.onOver({ score: pqHeight(s), height: pqHeight(s) });
        return;
      }
      env.haptic(ev.type === 'perfect' ? [8, 16, 8] : 8);
      if (ev.type === 'perfect') {
        const pose = s.stack[s.stack.length - 1];
        flottants.push({ txt: pose.w > top.w ? 'PARFAIT ! +largeur' : 'PARFAIT !', x: env.W / 2, y: env.H * 0.35, t: 0, color: '#fde047', size: 26 });
      }
      env.onScore(pqHeight(s));
    },
    update(dt) { pqStep(s, dt); },
    draw(dt) {
      const ctx = env.ctx, W = env.W, H = env.H;
      const u = W / PQ.LARGEUR;
      const sol = H - 60;
      // La caméra suit le sommet de la pile en douceur
      const cible = Math.max(0, (s.stack.length + 1) * HAUTEUR - (H * 0.55));
      camera += (cible - camera) * Math.min(1, dt * 6);

      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#fce7f3');
      grad.addColorStop(1, '#ede9fe');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(0, camera);
      ctx.fillStyle = '#a78bfa';
      ctx.fillRect(0, sol, W, H);
      s.stack.forEach((b, i) => rouleau(ctx, b.x * u, sol - (i + 1) * HAUTEUR, b.w * u, HAUTEUR - 3, i === 0 ? '#e9d5ff' : '#fff'));
      if (!s.over) rouleau(ctx, s.cur.x * u, sol - (s.stack.length + 1) * HAUTEUR, s.cur.w * u, HAUTEUR - 3, '#fefce8');
      for (let i = chutes.length - 1; i >= 0; i--) {
        const c = chutes[i];
        c.vy += 900 * dt; c.y += c.vy * dt; c.rot += dt * 2;
        if (c.y > H + camera) { chutes.splice(i, 1); continue; }
        ctx.save();
        ctx.translate(c.x + c.w / 2, sol - c.level * HAUTEUR + HAUTEUR / 2 + c.y);
        ctx.rotate(c.rot);
        rouleau(ctx, -c.w / 2, -HAUTEUR / 2, c.w, HAUTEUR - 3, '#fde68a');
        ctx.restore();
      }
      ctx.restore();

      D.flotter(ctx, flottants, dt);
      D.texte(ctx, `${pqHeight(s)}`, W / 2, 50, { size: 54, color: '#4c1d95' });
      if (s.perfectStreak >= 2) D.texte(ctx, `✨ x${s.perfectStreak}`, W - 16, 30, { size: 20, align: 'right', color: '#7c3aed' });
    },
  };
}

window.JeuPQ = { PQ, pqNew, pqHeight, pqStep, pqPlace, create: pqCreate };
