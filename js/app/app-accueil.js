// ============================================================
//  app-accueil.js
//  accueil allege (v2.18.0) : carte « Aujourd'hui » avec la mascotte,
//  blocs secondaires replies, rappel du Wrapped, theme systeme
//  Charge apres app-render.js et app-sante.js.
// ============================================================

// ===================================================
//  MASCOTTE 💩
// ===================================================
// Niveaux : la mascotte grandit avec le nombre total de cacas.
const MASCOT_LEVELS = [
  { min: 0,   name: 'Bébé caca' },
  { min: 10,  name: 'Petit caca' },
  { min: 50,  name: 'Caca confirmé' },
  { min: 150, name: 'Grand caca' },
  { min: 365, name: 'Caca légendaire' },
];

/** Fonction pure : niveau atteint et progression vers le suivant (0..1). */
function mascotLevel(total) {
  let i = 0;
  while (i + 1 < MASCOT_LEVELS.length && total >= MASCOT_LEVELS[i + 1].min) i++;
  const cur = MASCOT_LEVELS[i], next = MASCOT_LEVELS[i + 1] || null;
  return {
    level: i + 1,
    name: cur.name,
    next: next ? next.name : null,
    remaining: next ? next.min - total : 0,
    progress: next ? (total - cur.min) / (next.min - cur.min) : 1,
  };
}

/**
 * Fonction pure : humeur, accessoire et message de la mascotte.
 * Priorité : inquiétude santé > fête > content > série en danger > dodo > attente.
 */
function mascotMood(logs, now = Date.now()) {
  const liste = [...(logs || [])].sort((a, b) => b.date - a.date);
  const heure = new Date(now).getHours();
  const debut = new Date(now); debut.setHours(0, 0, 0, 0);
  const aujourdhui = liste.filter(l => l.date >= debut.getTime() && l.date <= now).length;
  const details = typeof streakDetails === 'function' ? streakDetails(liste, now) : { current: 0, pending: 0 };
  const serie = details.current || details.pending;
  const accessory = serie >= 30 ? 'crown' : serie >= 7 ? 'glasses' : 'none';

  if (!liste.length) {
    return { mood: 'waiting', accessory, message: 'Salut ! Appuie sur le gros bouton pour ton tout premier caca.' };
  }

  const heuresDepuis = (now - liste[0].date) / 3600000;
  const trois = liste.slice(0, 3);
  const sang = typeof bloodAlert === 'function' ? bloodAlert(liste, now) : null;
  if (sang) return { mood: 'worried', accessory, message: 'Tu as noté du sang. Si ça revient, parles-en à un médecin.' };
  if (heuresDepuis > 48) return { mood: 'worried', accessory, message: `${Math.round(heuresDepuis)} h sans caca… Bois de l'eau et mange des fibres !` };
  if (trois.length === 3 && trois.every(l => l.texture === 'liquide' || l.texture === 'explosif')) {
    return { mood: 'worried', accessory, message: 'Ça coule beaucoup ces temps-ci : hydrate-toi bien.' };
  }
  if (trois.length === 3 && trois.every(l => l.texture === 'dur')) {
    return { mood: 'worried', accessory, message: 'Trois cacas durs d\'affilée : un grand verre d\'eau ?' };
  }

  if (aujourdhui > 0 && details.current >= 7) {
    return { mood: 'party', accessory, message: `${details.current} jours de suite, tu es en feu !` };
  }
  if (aujourdhui > 0) {
    return { mood: 'happy', accessory, message: aujourdhui > 1 ? `${aujourdhui} cacas aujourd'hui, belle journée !` : 'Mission du jour accomplie. Bravo !' };
  }
  if (details.pending >= 2) {
    return { mood: heure >= 18 ? 'worried' : 'waiting', accessory,
             message: `Ta série de ${details.pending} jours t'attend : un caca avant minuit pour la garder !` };
  }
  if (heure >= 22 || heure < 7) return { mood: 'sleepy', accessory, message: 'Chut… les intestins dorment aussi.' };
  return { mood: 'waiting', accessory, message: 'Pas encore de caca aujourd\'hui. Je t\'attends !' };
}

/** SVG de la mascotte pour une humeur et un accessoire donnés. */
function mascotSVG(mood = 'waiting', accessory = 'none') {
  const yeux = {
    happy:   '<path d="M40 60q5-6 10 0M70 60q5-6 10 0" stroke="#2b1708" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
    party:   '<path d="M40 60q5-6 10 0M70 60q5-6 10 0" stroke="#2b1708" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
    sleepy:  '<path d="M39 60h12M69 60h12" stroke="#2b1708" stroke-width="3.5" stroke-linecap="round"/>',
    worried: '<circle cx="45" cy="60" r="6" fill="#fff"/><circle cx="75" cy="60" r="6" fill="#fff"/><circle cx="45" cy="62" r="3" fill="#2b1708"/><circle cx="75" cy="62" r="3" fill="#2b1708"/><path d="M37 49l14 4M83 49l-14 4" stroke="#2b1708" stroke-width="3" stroke-linecap="round"/>',
    waiting: '<circle cx="45" cy="60" r="6.5" fill="#fff"/><circle cx="75" cy="60" r="6.5" fill="#fff"/><circle cx="46" cy="61" r="3.2" fill="#2b1708"/><circle cx="76" cy="61" r="3.2" fill="#2b1708"/>',
  }[mood] || '';
  const bouche = {
    happy:   '<path d="M47 76q13 12 26 0" stroke="#2b1708" stroke-width="3.5" fill="#7a2e1a" stroke-linecap="round"/>',
    party:   '<path d="M45 74q15 18 30 0Z" fill="#7a2e1a" stroke="#2b1708" stroke-width="3" stroke-linejoin="round"/><path d="M52 80q8 5 16 0" stroke="#f472b6" stroke-width="3" fill="none"/>',
    sleepy:  '<ellipse cx="60" cy="78" rx="5" ry="3.5" fill="#7a2e1a"/>',
    worried: '<path d="M48 81q12-9 24 0" stroke="#2b1708" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
    waiting: '<path d="M50 77q10 6 20 0" stroke="#2b1708" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
  }[mood] || '';
  const extra = {
    sleepy:  '<text x="88" y="30" font-size="16" font-weight="700" fill="#6366f1">z</text><text x="98" y="18" font-size="12" font-weight="700" fill="#6366f1">z</text>',
    worried: '<path d="M92 44q4 7 0 10q-4-3 0-10Z" fill="#60a5fa"/>',
    party:   '<circle cx="18" cy="30" r="3" fill="#f59e0b"/><circle cx="104" cy="36" r="3" fill="#ec4899"/><rect x="96" y="14" width="5" height="5" fill="#10b981" transform="rotate(20 98 16)"/><rect x="14" y="12" width="5" height="5" fill="#6366f1" transform="rotate(-15 16 14)"/>',
    happy:   '<circle cx="36" cy="72" r="5" fill="#f9a8d4" opacity=".6"/><circle cx="84" cy="72" r="5" fill="#f9a8d4" opacity=".6"/>',
  }[mood] || '';
  const acc = {
    crown:   '<g transform="translate(0,-14)"><path d="M40 22l8 10 12-14 12 14 8-10v16H40Z" fill="#fbbf24" stroke="#b45309" stroke-width="2" stroke-linejoin="round"/><circle cx="60" cy="18" r="3" fill="#ef4444"/></g>',
    glasses: '<rect x="33" y="52" width="24" height="15" rx="6" fill="#111"/><rect x="63" y="52" width="24" height="15" rx="6" fill="#111"/><path d="M57 58h6" stroke="#111" stroke-width="3"/><path d="M37 55l6 0" stroke="#fff" stroke-width="2" opacity=".6"/>',
  }[accessory] || '';
  // Lunettes de soleil : elles remplacent les yeux, sauf quand elle dort.
  const regard = accessory === 'glasses' && mood !== 'sleepy' ? acc : yeux;
  const chapeau = accessory === 'crown' ? acc : '';
  return `
    <svg viewBox="0 0 120 120" class="mascot-svg mascot-${mood}" role="img" aria-label="Mascotte ${mood}">
      <ellipse cx="60" cy="108" rx="40" ry="6" fill="rgba(0,0,0,.12)"/>
      <g class="mascot-body">
        <ellipse cx="60" cy="92" rx="46" ry="16" fill="#8B5A2B"/>
        <ellipse cx="60" cy="70" rx="38" ry="18" fill="#9C6B3A"/>
        <ellipse cx="60" cy="50" rx="28" ry="14" fill="#A97745"/>
        <path d="M60 22c9 3 14 12 8 20H52c-5-8 0-17 8-20Z" fill="#B5834F"/>
        ${chapeau}
        ${regard}
        ${bouche}
        ${extra}
      </g>
    </svg>`;
}

function renderHomeCard() {
  const hote = $id('mascot');
  if (!hote) return;
  const m = mascotMood(state.logs);
  const niv = mascotLevel(state.logs.length);
  hote.innerHTML = mascotSVG(m.mood, m.accessory);
  const bulle = $id('mascot-message');
  if (bulle) bulle.textContent = m.message;
  const lvl = $id('mascot-level');
  if (lvl) {
    lvl.innerHTML = `
      <div class="flex items-center justify-between text-[11px] font-bold opacity-70">
        <span>Niv. ${niv.level} · ${esc(niv.name)}</span>
        <span>${niv.next ? `encore ${niv.remaining} pour « ${esc(niv.next)} »` : 'niveau max !'}</span>
      </div>
      <div class="w-full rounded-full overflow-hidden mt-1" style="height:6px;background:rgba(0,0,0,0.08)">
        <div style="width:${Math.round(niv.progress * 100)}%;height:100%;border-radius:99px;background:var(--accent);transition:width .6s"></div>
      </div>`;
  }
  const { current, pending } = streakDetails();
  const serieEl = $id('home-streak');
  if (serieEl) {
    serieEl.textContent = current || pending || 0;
    serieEl.closest('.home-stat')?.classList.toggle('streak-pending', !current && pending > 0);
  }
  renderWrappedReminder();
}

// ===================================================
//  BLOCS REPLIABLES
// ===================================================
const HOME_MORE_KEY = 'home.moreOpen';

function setupHome() {
  const plus = $id('home-more');
  if (plus) {
    try { plus.open = localStorage.getItem(HOME_MORE_KEY) === '1'; } catch {}
    plus.addEventListener('toggle', () => {
      try { localStorage.setItem(HOME_MORE_KEY, plus.open ? '1' : '0'); } catch {}
    });
  }
  // Toucher la mascotte la fait sauter : purement pour le plaisir.
  $id('mascot')?.addEventListener('click', () => {
    const svg = $id('mascot').querySelector('.mascot-svg');
    if (!svg) return;
    svg.classList.remove('mascot-jump');
    void svg.getBoundingClientRect();   // relance l'animation
    svg.classList.add('mascot-jump');
    if (typeof haptic === 'function') haptic(10);
  });
}

// ===================================================
//  RAPPEL DU WRAPPED 🎬
// ===================================================
/** Fonction pure : année à mettre en avant, ou null hors période (15 déc → 15 janv). */
function wrappedSeason(now = Date.now()) {
  const d = new Date(now);
  if (d.getMonth() === 11 && d.getDate() >= 15) return d.getFullYear();
  if (d.getMonth() === 0 && d.getDate() <= 15) return d.getFullYear() - 1;
  return null;
}

function renderWrappedReminder() {
  const carte = $id('home-wrapped-card');
  if (!carte) return;
  const annee = wrappedSeason();
  const aDesDonnees = annee !== null && state.logs.some(l => new Date(l.date).getFullYear() === annee);
  carte.classList.toggle('hidden', !aDesDonnees);
  const titre = $id('home-wrapped-year');
  if (titre && annee !== null) titre.textContent = annee;
}

// ===================================================
//  THÈME SYSTÈME 🌓
// ===================================================
const SYSTEM_THEME_KEY = 'theme.followSystem';

function systemThemeEnabled() {
  try { return localStorage.getItem(SYSTEM_THEME_KEY) === 'on'; } catch { return false; }
}

function systemPrefersDark() {
  return systemThemeEnabled() && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

window.toggleSystemTheme = function() {
  try { localStorage.setItem(SYSTEM_THEME_KEY, systemThemeEnabled() ? 'off' : 'on'); } catch {}
  refreshSystemThemeToggle();
  applyAutoNight();
};

function refreshSystemThemeToggle() {
  const on = systemThemeEnabled();
  const btn = $id('system-theme-toggle'), knob = $id('system-theme-knob');
  if (btn)  btn.style.background = on ? '#4f46e5' : 'rgba(0,0,0,0.15)';
  if (knob) knob.style.transform = on ? 'translateX(20px)' : 'translateX(0)';
}

function setupSystemTheme() {
  refreshSystemThemeToggle();
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  // Le téléphone passe en sombre le soir : l'app suit sans attendre la minute.
  mq?.addEventListener?.('change', () => applyAutoNight());
  applyAutoNight();
}
