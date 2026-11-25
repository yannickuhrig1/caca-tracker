// ============================================================
//  app-costumes.js
//  Économie de « Rouleaux d'Or » 🧻 & Garde-robe de la mascotte (v3.0)
//  Script classique global (sans import/export, compatible node:vm).
// ============================================================

const WARDROBE_STORAGE_KEY = 'mascot.wardrobe.v1';

const MASCOT_COSTUMES = [
  { id: 'none',       name: 'Naturel',            emoji: '💩', cost: 0 },
  { id: 'glasses',    name: 'Lunettes Star',      emoji: '🕶️', cost: 30, freeStreak: 7 },
  { id: 'crown',      name: 'Couronne Royale',    emoji: '👑', cost: 80, freeStreak: 30 },
  { id: 'beret',      name: 'Béret Artiste',      emoji: '🎨', cost: 40 },
  { id: 'headphones', name: 'Casque Audio',       emoji: '🎧', cost: 50 },
  { id: 'flowers',    name: 'Couronne de Fleurs', emoji: '🌸', cost: 45 },
  { id: 'chef',       name: 'Toque Chef',         emoji: '👩‍🍳', cost: 60 },
  { id: 'wizard',     name: 'Chapeau Magique',    emoji: '🪄', cost: 90 },
];

/** Métadonnées d'un costume par identifiant, ou null. */
function costumeMeta(id) {
  return MASCOT_COSTUMES.find(c => c.id === id) || null;
}

function _costumeEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function _costumeEl(id) {
  if (typeof $id === 'function') return $id(id);
  return typeof document !== 'undefined' && document?.getElementById
    ? document.getElementById(id)
    : null;
}

function _currentLogs() {
  return typeof state !== 'undefined' && Array.isArray(state?.logs) ? state.logs : [];
}

function _calcLongestRun(logs) {
  if (!Array.isArray(logs) || !logs.length) return 0;
  const jours = [...new Set(
    logs
      .filter(l => l && Number.isFinite(Number(l.date)))
      .map(l => {
        const d = new Date(Number(l.date));
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })
  )].sort((a, b) => a - b);
  let best = 0, cur = 0, prev = null;
  jours.forEach(j => {
    cur = prev !== null && j - prev > 20 * 3600000 && j - prev < 28 * 3600000 ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = j;
  });
  return best;
}

function _currentBestStreak(logs = _currentLogs()) {
  const bestRun = typeof longestRun === 'function' ? longestRun(logs) : _calcLongestRun(logs);
  const details = typeof streakDetails === 'function' ? streakDetails(logs) : null;
  const activeRun = details ? Math.max(details.current || 0, details.pending || 0) : 0;
  return Math.max(bestRun, activeRun);
}

function _currentGamesPlayed() {
  try {
    if (typeof loadGameStats === 'function' && window.JeuxCore?.totalPlays) {
      return window.JeuxCore.totalPlays(loadGameStats());
    }
    const raw = JSON.parse(localStorage.getItem('jeux.stats.v1') || 'null');
    if (raw && raw.plays && typeof raw.plays === 'object') {
      return Object.values(raw.plays).reduce(
        (sum, v) => sum + (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0),
        0
      );
    }
  } catch {}
  return 0;
}

/** Relit l'état de la garde-robe depuis localStorage en le normalisant. */
function loadWardrobe() {
  const base = { unlocked: ['none'], equipped: 'auto' };
  try {
    const raw = JSON.parse(localStorage.getItem(WARDROBE_STORAGE_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return base;
    const seen = new Set(['none']);
    if (Array.isArray(raw.unlocked)) {
      raw.unlocked.forEach(id => {
        if (typeof id === 'string' && costumeMeta(id)) seen.add(id);
      });
    }
    const equipped = raw.equipped === 'auto' || costumeMeta(raw.equipped)
      ? raw.equipped
      : 'auto';
    return { unlocked: [...seen], equipped };
  } catch {
    return base;
  }
}

/** Sauvegarde l'état de la garde-robe dans localStorage. */
function saveWardrobe(wardrobe) {
  const seen = new Set(['none']);
  (wardrobe?.unlocked || []).forEach(id => {
    if (typeof id === 'string' && costumeMeta(id)) seen.add(id);
  });
  const equipped = wardrobe?.equipped === 'auto' || costumeMeta(wardrobe?.equipped)
    ? wardrobe.equipped
    : 'auto';
  const clean = { unlocked: [...seen], equipped };
  try {
    localStorage.setItem(WARDROBE_STORAGE_KEY, JSON.stringify(clean));
  } catch {}
  return clean;
}

/**
 * Fonction pure : nombre total de Rouleaux d'Or 🧻 gagnés.
 * Formule : (logs.length * 5) + (Math.floor(bestStreak / 7) * 15) + (gamesPlayed * 2)
 */
function computeEarnedRolls(logs = [], bestStreak = 0, gamesPlayed = 0) {
  const nbLogs = Array.isArray(logs) ? logs.length : 0;
  const streak = Math.max(0, Math.floor(Number(bestStreak) || 0));
  const games = Math.max(0, Math.floor(Number(gamesPlayed) || 0));
  return (nbLogs * 5) + (Math.floor(streak / 7) * 15) + (games * 2);
}

/** Vrai si le costume est gratuit, acheté ou débloqué par un palier de série. */
function isCostumeUnlocked(id, bestStreak = 0) {
  const c = costumeMeta(id);
  if (!c) return false;
  if (c.cost === 0) return true;
  const w = loadWardrobe();
  if (w.unlocked.includes(id)) return true;
  const streak = Math.max(0, Math.floor(Number(bestStreak) || 0));
  if (c.freeStreak && streak >= c.freeStreak) return true;
  return false;
}

/** Somme des rouleaux dépensés pour les costumes achetés. */
function getSpentRolls() {
  const w = loadWardrobe();
  return w.unlocked.reduce((sum, id) => {
    const c = costumeMeta(id);
    return sum + (c && c.cost > 0 ? c.cost : 0);
  }, 0);
}

/** Solde de Rouleaux d'Or 🧻 disponibles (jamais négatif). */
function getAvailableRolls(logs, bestStreak, gamesPlayed) {
  const useAppState = logs === undefined;
  const l = useAppState ? _currentLogs() : logs;
  const bs = useAppState && bestStreak === undefined ? _currentBestStreak(l) : (bestStreak ?? 0);
  const gp = useAppState && gamesPlayed === undefined ? _currentGamesPlayed() : (gamesPlayed ?? 0);
  const earned = computeEarnedRolls(l, bs, gp);
  return Math.max(0, earned - getSpentRolls());
}

/** Achète un costume avec les Rouleaux d'Or disponibles. */
function buyCostume(id, logs, bestStreak, gamesPlayed) {
  const useAppState = logs === undefined;
  const l = useAppState ? _currentLogs() : logs;
  const bs = useAppState && bestStreak === undefined ? _currentBestStreak(l) : (bestStreak ?? 0);
  const gp = useAppState && gamesPlayed === undefined ? _currentGamesPlayed() : (gamesPlayed ?? 0);
  const available = getAvailableRolls(l, bs, gp);

  const c = costumeMeta(id);
  if (!c) {
    return { ok: false, remaining: available, reason: 'unknown_costume' };
  }
  if (isCostumeUnlocked(id, bs)) {
    return { ok: false, remaining: available, reason: 'already_unlocked' };
  }
  if (available < c.cost) {
    return { ok: false, remaining: available, reason: 'not_enough_rolls' };
  }

  const w = loadWardrobe();
  w.unlocked.push(id);
  saveWardrobe(w);
  return { ok: true, remaining: Math.max(0, available - c.cost), reason: null };
}

/** Équipe `'auto'` ou un identifiant de costume débloqué. */
function equipCostume(id, bestStreak) {
  if (id === 'auto') {
    const w = loadWardrobe();
    w.equipped = 'auto';
    saveWardrobe(w);
    return true;
  }
  const bs = bestStreak !== undefined ? (Number(bestStreak) || 0) : _currentBestStreak();
  if (!costumeMeta(id) || !isCostumeUnlocked(id, bs)) return false;
  const w = loadWardrobe();
  w.equipped = id;
  saveWardrobe(w);
  return true;
}

/** Résout l'accessoire effectivement porté par la mascotte. */
function resolveActiveAccessory(autoAccessory = 'none', bestStreak) {
  const fallback = costumeMeta(autoAccessory) ? autoAccessory : 'none';
  const w = loadWardrobe();
  if (!w.equipped || w.equipped === 'auto') return fallback;
  const bs = bestStreak !== undefined ? (Number(bestStreak) || 0) : _currentBestStreak();
  return isCostumeUnlocked(w.equipped, bs) ? w.equipped : fallback;
}

/** Fait défiler vers le prochain costume débloqué et renvoie son identifiant. */
function cycleMascotCostume(bestStreak) {
  const explicitStreak = bestStreak !== undefined;
  const bs = explicitStreak ? (Number(bestStreak) || 0) : _currentBestStreak();
  const unlockedIds = MASCOT_COSTUMES
    .filter(c => isCostumeUnlocked(c.id, bs))
    .map(c => c.id);

  if (unlockedIds.length <= 1) return 'none';

  const w = loadWardrobe();
  let curId = 'none';
  if (w.equipped && w.equipped !== 'auto' && unlockedIds.includes(w.equipped)) {
    curId = w.equipped;
  } else if (!explicitStreak && typeof mascotMood === 'function') {
    const autoAcc = mascotMood(_currentLogs()).accessory;
    if (unlockedIds.includes(autoAcc)) curId = autoAcc;
  }

  const idx = unlockedIds.indexOf(curId);
  const nextId = unlockedIds[(idx + 1) % unlockedIds.length];
  w.equipped = nextId;
  saveWardrobe(w);
  return nextId;
}

/** Met à jour le badge `#home-rolls-badge` s'il est présent dans le DOM. */
function updateHomeRollsBadge() {
  const badge = _costumeEl('home-rolls-badge');
  if (badge) {
    badge.textContent = `🧻 ${getAvailableRolls()}`;
  }
}

/** Génère le panneau Garde-robe dans `#badges-tab` et rafraîchit `#home-rolls-badge`. */
function renderWardrobePanel(containerId = 'wardrobe-container') {
  updateHomeRollsBadge();
  const container = _costumeEl(containerId);
  if (!container) return;

  const logs = _currentLogs();
  const bestStreak = _currentBestStreak(logs);
  const gamesPlayed = _currentGamesPlayed();
  const available = getAvailableRolls(logs, bestStreak, gamesPlayed);
  const earned = computeEarnedRolls(logs, bestStreak, gamesPlayed);
  const w = loadWardrobe();
  const moodInfo = typeof mascotMood === 'function'
    ? mascotMood(logs)
    : { mood: 'happy', accessory: bestStreak >= 30 ? 'crown' : bestStreak >= 7 ? 'glasses' : 'none' };
  const activeAcc = resolveActiveAccessory(moodInfo.accessory, bestStreak);
  const activeMeta = costumeMeta(activeAcc) || MASCOT_COSTUMES[0];

  const previewMain = typeof mascotSVG === 'function'
    ? mascotSVG(moodInfo.mood || 'happy', activeAcc)
    : `<span class="text-4xl">${activeMeta.emoji}</span>`;

  const cardsHTML = MASCOT_COSTUMES.map(c => {
    const unlocked = isCostumeUnlocked(c.id, bestStreak);
    const isManualEquipped = w.equipped === c.id;
    const isAutoActive = w.equipped === 'auto' && activeAcc === c.id;
    const isSelected = isManualEquipped || isAutoActive;
    const canBuy = available >= c.cost;
    const freeByStreak = !!(c.freeStreak && bestStreak >= c.freeStreak && !w.unlocked.includes(c.id));
    const miniSVG = typeof mascotSVG === 'function'
      ? `<div class="w-14 h-14 mx-auto">${mascotSVG('happy', c.id)}</div>`
      : `<div class="text-3xl my-1">${c.emoji}</div>`;

    let actionHTML = '';
    if (unlocked) {
      const btnLabel = isManualEquipped
        ? '✅ Équipé'
        : isAutoActive
          ? '✨ Porté'
          : 'Équiper';
      const btnStyle = isSelected
        ? 'background:var(--accent);color:#fff'
        : 'background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--accent)';
      actionHTML = `
        ${freeByStreak ? `<div class="text-[10px] font-bold opacity-70 mb-1">🔥 Offert (${c.freeStreak}j)</div>` : ''}
        <button type="button" data-costume-equip="${_costumeEsc(c.id)}"
          class="w-full py-1.5 px-2 rounded-xl text-xs font-bold transition"
          style="${btnStyle}">${btnLabel}</button>`;
    } else {
      const btnStyle = canBuy
        ? 'background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff'
        : 'background:rgba(128,128,128,0.15);color:var(--text-secondary);opacity:0.75';
      actionHTML = `
        ${c.freeStreak ? `<div class="text-[10px] opacity-65 mb-1">ou gratuit à ${c.freeStreak}j 🔥</div>` : '<div class="text-[10px] opacity-50 mb-1">Boutique</div>'}
        <button type="button" data-costume-buy="${_costumeEsc(c.id)}"
          class="w-full py-1.5 px-2 rounded-xl text-xs font-bold transition"
          style="${btnStyle}">🧻 ${c.cost}</button>`;
    }

    const cardBorder = isSelected
      ? 'border:2px solid var(--accent);background:color-mix(in srgb,var(--accent) 8%,var(--card-bg))'
      : 'border:1.5px solid var(--card-border);background:var(--card-bg)';

    return `
      <div class="rounded-[1.25rem] p-3 text-center flex flex-col justify-between transition"
           data-costume-card="${_costumeEsc(c.id)}" style="${cardBorder}">
        <div>
          ${miniSVG}
          <div class="font-bold text-xs mt-1 leading-tight">${c.emoji} ${_costumeEsc(c.name)}</div>
        </div>
        <div class="mt-2">${actionHTML}</div>
      </div>`;
  }).join('');

  const autoBtnStyle = w.equipped === 'auto'
    ? 'background:var(--accent);color:#fff'
    : 'background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent)';

  container.innerHTML = `
    <div class="card rounded-[2rem] p-4 shadow mb-4">
      <div class="flex items-center justify-between gap-2 mb-3">
        <div>
          <h4 class="font-bold text-sm">👗 Garde-robe de la mascotte</h4>
          <p class="text-[11px] opacity-60">+5 🧻/caca · +15 🧻/7j record · +2 🧻/partie (${earned} gagnés)</p>
        </div>
        <div class="px-3 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap"
             style="background:color-mix(in srgb,#f59e0b 18%,transparent);color:#d97706">
          🧻 ${available}
        </div>
      </div>
      <div class="flex items-center gap-3 p-3 rounded-[1.25rem] mb-3"
           style="background:color-mix(in srgb,var(--accent) 7%,transparent)">
        <div class="w-16 h-16 flex-shrink-0">${previewMain}</div>
        <div class="flex-1 min-w-0">
          <div class="text-xs opacity-65">Tenue actuelle</div>
          <div class="font-bold text-sm truncate">${activeMeta.emoji} ${_costumeEsc(activeMeta.name)}</div>
          <button type="button" data-costume-equip="auto"
            class="mt-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition"
            style="${autoBtnStyle}">
            ✨ Mode auto (selon série)
          </button>
        </div>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        ${cardsHTML}
      </div>
    </div>`;

  if (typeof container.addEventListener === 'function' && !container._wardrobeBound) {
    container._wardrobeBound = true;
    container.addEventListener('click', e => {
      const equipBtn = e.target?.closest?.('[data-costume-equip]');
      if (equipBtn) {
        const targetId = equipBtn.getAttribute('data-costume-equip');
        if (equipCostume(targetId)) {
          if (typeof haptic === 'function') haptic(10);
          renderWardrobePanel(containerId);
          if (typeof renderHomeCard === 'function') renderHomeCard();
        }
        return;
      }
      const buyBtn = e.target?.closest?.('[data-costume-buy]');
      if (buyBtn) {
        const targetId = buyBtn.getAttribute('data-costume-buy');
        const meta = costumeMeta(targetId);
        const res = buyCostume(targetId);
        if (res.ok) {
          equipCostume(targetId);
          if (typeof haptic === 'function') haptic(20);
          window.UI?.toast?.(`Costume « ${meta ? meta.name : targetId} » débloqué !`, 'party');
          renderWardrobePanel(containerId);
          if (typeof renderHomeCard === 'function') renderHomeCard();
        } else if (res.reason === 'not_enough_rolls' && meta) {
          window.UI?.toast?.(`Il te manque ${meta.cost - res.remaining} 🧻 pour « ${meta.name} » !`, 'info');
        }
      }
    });
  }
}
