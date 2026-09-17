// ============================================================
//  colon.js — Le Côlon 🐍
//  Un Snake où le serpent est un intestin. Les fibres 🥦 le font grandir,
//  le fast-food 🍔 le bouche (il rétrécit, on perd des points), le piment
//  🌶️ rapporte gros mais accélère le transit quelques secondes.
//  Glisser le doigt pour tourner (flèches au clavier).
//  Logique pure testée : test/jeux-arcade.test.js
// ============================================================

const COLON = {
  COLS: 14,
  ROWS: 20,
  TICK_INIT: 170,        // ms entre deux pas
  TICK_MIN: 95,
  TICK_PIMENT: 80,
  PIMENT_PAS: 30,        // durée de l'accélération, en pas
  LONGUEUR_MIN: 3,
};

const COLON_DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const COLON_OPPOSE = { up: 'down', down: 'up', left: 'right', right: 'left' };

function colonNew(rng = Math.random) {
  const x = Math.floor(COLON.COLS / 2), y = Math.floor(COLON.ROWS / 2) + 2;
  const s = {
    snake: [{ x, y }, { x, y: y + 1 }, { x, y: y + 2 }],
    dir: 'up', next: 'up', items: [], score: 0, grow: 0, boost: 0,
    acc: 0, over: false, maxLength: 3, eaten: { fibre: 0, burger: 0, piment: 0 },
  };
  colonSpawn(s, 'fibre', rng);
  return s;
}

function colonTurn(s, dir) {
  if (!COLON_DIRS[dir] || s.over) return false;
  // On compare au sens réellement pris au dernier pas : deux virages rapides
  // ne doivent pas permettre un demi-tour sur soi-même.
  if (dir === COLON_OPPOSE[s.dir]) return false;
  const change = dir !== s.next;
  s.next = dir;
  return change;
}

function colonFree(s, x, y) {
  return !s.snake.some(p => p.x === x && p.y === y) && !s.items.some(i => i.x === x && i.y === y);
}

/** Pose un objet sur une case libre. Rend l'objet, ou null si la grille est pleine. */
function colonSpawn(s, type, rng = Math.random) {
  const libres = [];
  for (let y = 0; y < COLON.ROWS; y++) for (let x = 0; x < COLON.COLS; x++) if (colonFree(s, x, y)) libres.push({ x, y });
  if (!libres.length) return null;
  const c = libres[Math.floor(rng() * libres.length)];
  const item = { ...c, type };
  s.items.push(item);
  return item;
}

function colonInterval(s) {
  if (s.boost > 0) return COLON.TICK_PIMENT;
  return Math.max(COLON.TICK_MIN, COLON.TICK_INIT - s.score * 2);
}

/** Un pas de serpent. Rend { type: 'move' | 'fibre' | 'burger' | 'piment' | 'over' }. */
function colonTick(s, rng = Math.random) {
  if (s.over) return { type: 'over' };
  s.dir = s.next;
  const [dx, dy] = COLON_DIRS[s.dir];
  const tete = { x: s.snake[0].x + dx, y: s.snake[0].y + dy };
  if (s.boost > 0) s.boost--;

  const dehors = tete.x < 0 || tete.y < 0 || tete.x >= COLON.COLS || tete.y >= COLON.ROWS;
  // La queue libère sa case pendant ce pas, sauf si le serpent grandit.
  const corps = s.grow > 0 ? s.snake : s.snake.slice(0, -1);
  if (dehors || corps.some(p => p.x === tete.x && p.y === tete.y)) {
    s.over = true;
    return { type: 'over' };
  }

  s.snake.unshift(tete);
  if (s.grow > 0) s.grow--; else s.snake.pop();

  const idx = s.items.findIndex(i => i.x === tete.x && i.y === tete.y);
  if (idx < 0) return { type: 'move' };
  const item = s.items.splice(idx, 1)[0];
  s.eaten[item.type]++;

  if (item.type === 'fibre') {
    s.score += 1;
    s.grow += 1;
    colonSpawn(s, 'fibre', rng);
    // De temps en temps, une tentation apparaît.
    if (!s.items.some(i => i.type === 'burger') && rng() < 0.35) colonSpawn(s, 'burger', rng);
    if (!s.items.some(i => i.type === 'piment') && s.score >= 5 && rng() < 0.2) colonSpawn(s, 'piment', rng);
  } else if (item.type === 'burger') {
    s.score = Math.max(0, s.score - 2);
    const garder = Math.max(COLON.LONGUEUR_MIN, s.snake.length - 2);
    s.snake.length = garder;
    s.grow = 0;
  } else if (item.type === 'piment') {
    s.score += 3;
    s.boost = COLON.PIMENT_PAS;
  }
  s.maxLength = Math.max(s.maxLength, s.snake.length + s.grow);
  return { type: item.type };
}

/** Fait avancer le temps de `dt` secondes ; rend les événements survenus. */
function colonStep(s, dt, rng = Math.random) {
  const evs = [];
  s.acc += dt * 1000;
  let garde = 0;
  while (!s.over && s.acc >= colonInterval(s) && garde++ < 5) {
    s.acc -= colonInterval(s);
    evs.push(colonTick(s, rng));
  }
  if (garde >= 5) s.acc = 0;   // onglet revenu de veille : pas de rattrapage fou
  return evs;
}

function colonCreate(env) {
  const D = window.JeuxCore.JeuxDessin;
  const s = colonNew(env.rng);
  const flottants = [];
  const EMOJI = { fibre: '🥦', burger: '🍔', piment: '🌶️' };

  function grille() {
    const W = env.W, H = env.H - 20;
    const cell = Math.floor(Math.min(W / COLON.COLS, H / COLON.ROWS));
    return { cell, ox: Math.floor((W - cell * COLON.COLS) / 2), oy: 10 + Math.floor((H - cell * COLON.ROWS) / 2) };
  }

  return {
    hint: 'Glisse le doigt pour tourner 👆',
    swipe(dir) { if (colonTurn(s, dir)) env.haptic(4); },
    // Taper à gauche ou à droite de la tête tourne aussi : pratique d'une main.
    tap(x, y) {
      const { cell, ox, oy } = grille();
      const t = s.snake[0];
      const dx = x - (ox + (t.x + 0.5) * cell), dy = y - (oy + (t.y + 0.5) * cell);
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      if (colonTurn(s, dir)) env.haptic(4);
    },
    update(dt) {
      const evs = colonStep(s, dt, env.rng);
      const { cell, ox, oy } = grille();
      const t = s.snake[0];
      evs.forEach(ev => {
        const x = ox + (t.x + 0.5) * cell, y = oy + t.y * cell;
        if (ev.type === 'fibre') { env.haptic(6); flottants.push({ txt: '+1', x, y, t: 0, color: '#bbf7d0' }); }
        if (ev.type === 'burger') { env.haptic([20, 20, 20]); flottants.push({ txt: 'Bouché ! -2', x, y, t: 0, color: '#fecaca' }); }
        if (ev.type === 'piment') { env.haptic([10, 10, 10, 10, 10]); flottants.push({ txt: '+3 ça brûle !', x, y, t: 0, color: '#fdba74' }); }
      });
      if (evs.length) env.onScore(s.score);
      if (evs.some(e => e.type === 'over')) {
        env.haptic([40, 30, 80]);
        env.onOver({ score: s.score, length: s.maxLength });
      }
    },
    draw(dt) {
      const ctx = env.ctx, W = env.W, H = env.H;
      const { cell, ox, oy } = grille();
      ctx.fillStyle = s.boost > 0 ? '#431407' : '#3f1d2b';
      ctx.fillRect(0, 0, W, H);
      // Paroi intestinale : damier rosé
      for (let y = 0; y < COLON.ROWS; y++) for (let x = 0; x < COLON.COLS; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#fbcfe8' : '#f9a8d4';
        ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
      }
      s.items.forEach(i => D.emoji(ctx, EMOJI[i.type], ox + (i.x + 0.5) * cell, oy + (i.y + 0.5) * cell, cell * 0.85));
      // Corps : du plus clair (queue) au plus foncé (tête)
      const n = s.snake.length;
      for (let i = n - 1; i >= 0; i--) {
        const p = s.snake[i];
        const k = i / Math.max(1, n - 1);
        ctx.fillStyle = `rgb(${Math.round(146 + 60 * k)},${Math.round(64 + 40 * k)},${Math.round(14 + 30 * k)})`;
        D.rrect(ctx, ox + p.x * cell + 1, oy + p.y * cell + 1, cell - 2, cell - 2, cell * 0.35);
        ctx.fill();
      }
      const t = s.snake[0];
      const cx = ox + (t.x + 0.5) * cell, cy = oy + (t.y + 0.5) * cell;
      const [dx, dy] = COLON_DIRS[s.dir];
      ctx.fillStyle = '#fff';
      [-1, 1].forEach(side => {
        const ex = cx + dx * cell * 0.15 + (dy !== 0 ? side * cell * 0.2 : 0);
        const ey = cy + dy * cell * 0.15 + (dx !== 0 ? side * cell * 0.2 : 0);
        ctx.beginPath(); ctx.arc(ex, ey, cell * 0.13, 0, Math.PI * 2); ctx.fill();
      });
      D.flotter(ctx, flottants, dt);
      if (s.boost > 0) D.texte(ctx, '🌶️ Transit accéléré', W / 2, H - 8, { size: 14, color: '#fdba74' });
    },
  };
}

window.JeuColon = { COLON, colonNew, colonTurn, colonSpawn, colonTick, colonStep, colonInterval, create: colonCreate };
