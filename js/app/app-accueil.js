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
    crown:      '<g transform="translate(0,-14)"><path d="M40 22l8 10 12-14 12 14 8-10v16H40Z" fill="#fbbf24" stroke="#b45309" stroke-width="2" stroke-linejoin="round"/><circle cx="60" cy="18" r="3" fill="#ef4444"/></g>',
    glasses:    '<rect x="33" y="52" width="24" height="15" rx="6" fill="#111"/><rect x="63" y="52" width="24" height="15" rx="6" fill="#111"/><path d="M57 58h6" stroke="#111" stroke-width="3"/><path d="M37 55l6 0" stroke="#fff" stroke-width="2" opacity=".6"/>',
    beret:      '<g class="mascot-acc mascot-acc-beret"><path d="M56 13l-3-5" stroke="#7f1d1d" stroke-width="2.5" stroke-linecap="round"/><path d="M30 29c-2-10 12-17 28-16 16 1 28 6 26 14-2 5-14 6-27 6-14 0-25 1-27-4Z" fill="#dc2626" stroke="#7f1d1d" stroke-width="2" stroke-linejoin="round"/><path d="M36 31c12-2 32-2 44 1" stroke="#450a0a" stroke-width="3" stroke-linecap="round"/></g>',
    headphones: '<g class="mascot-acc mascot-acc-headphones"><path d="M23 60C23 26 97 26 97 60" fill="none" stroke="#1e293b" stroke-width="5" stroke-linecap="round"/><path d="M38 30c14-7 30-7 44 0" fill="none" stroke="#6366f1" stroke-width="3" stroke-linecap="round"/><rect x="15" y="50" width="11" height="22" rx="5.5" fill="#6366f1" stroke="#1e293b" stroke-width="2"/><rect x="94" y="50" width="11" height="22" rx="5.5" fill="#6366f1" stroke="#1e293b" stroke-width="2"/><rect x="23" y="53" width="4" height="16" rx="2" fill="#a5b4fc"/><rect x="93" y="53" width="4" height="16" rx="2" fill="#a5b4fc"/></g>',
    flowers:    '<g class="mascot-acc mascot-acc-flowers"><path d="M34 38q26 6 52 0" fill="none" stroke="#15803d" stroke-width="3" stroke-linecap="round"/><ellipse cx="38" cy="36" rx="5" ry="2.5" transform="rotate(-25 38 36)" fill="#22c55e"/><ellipse cx="82" cy="36" rx="5" ry="2.5" transform="rotate(25 82 36)" fill="#22c55e"/><g transform="translate(46,37)"><circle cx="0" cy="-4" r="3.2" fill="#f9a8d4"/><circle cx="4" cy="0" r="3.2" fill="#f9a8d4"/><circle cx="0" cy="4" r="3.2" fill="#f9a8d4"/><circle cx="-4" cy="0" r="3.2" fill="#f9a8d4"/><circle cx="0" cy="0" r="2.5" fill="#fde047"/></g><g transform="translate(60,35)"><circle cx="0" cy="-4.5" r="3.6" fill="#f472b6"/><circle cx="4.5" cy="0" r="3.6" fill="#f472b6"/><circle cx="0" cy="4.5" r="3.6" fill="#f472b6"/><circle cx="-4.5" cy="0" r="3.6" fill="#f472b6"/><circle cx="0" cy="0" r="2.8" fill="#fef08a"/></g><g transform="translate(74,37)"><circle cx="0" cy="-4" r="3.2" fill="#c4b5fd"/><circle cx="4" cy="0" r="3.2" fill="#c4b5fd"/><circle cx="0" cy="4" r="3.2" fill="#c4b5fd"/><circle cx="-4" cy="0" r="3.2" fill="#c4b5fd"/><circle cx="0" cy="0" r="2.5" fill="#fde047"/></g></g>',
    chef:       '<g class="mascot-acc mascot-acc-chef"><path d="M43 26c-7-2-9-11-3-15 3-6 12-8 20-8s17 2 20 8c6 4 4 13-3 15v8H43Z" fill="#ffffff" stroke="#94a3b8" stroke-width="2" stroke-linejoin="round"/><rect x="43" y="27" width="34" height="7" rx="2" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.8"/><path d="M52 16v9M60 14v11M68 16v9" stroke="#cbd5e1" stroke-width="1.8" stroke-linecap="round"/></g>',
    wizard:     '<g class="mascot-acc mascot-acc-wizard"><path d="M60 4c4 8 10 17 16 25H44C50 20 55 11 60 4Z" fill="#4f46e5" stroke="#312e81" stroke-width="2" stroke-linejoin="round"/><path d="M44 26h32l3 5H41Z" fill="#fbbf24" stroke="#b45309" stroke-width="1.5" stroke-linejoin="round"/><ellipse cx="60" cy="32" rx="28" ry="5" fill="#4338ca" stroke="#312e81" stroke-width="2"/><circle cx="58" cy="18" r="2" fill="#fde047"/><circle cx="65" cy="23" r="1.4" fill="#fde047"/></g>',
  }[accessory] || '';
  // Lunettes de soleil : elles remplacent les yeux, sauf quand elle dort.
  const regard = accessory === 'glasses' && mood !== 'sleepy' ? acc : yeux;
  const chapeau = (accessory === 'crown' || accessory === 'beret' || accessory === 'headphones' || accessory === 'flowers' || accessory === 'chef' || accessory === 'wizard') ? acc : '';
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
  const rollsBadge = $id('home-rolls-badge');
  if (rollsBadge && typeof getAvailableRolls === 'function') {
    rollsBadge.textContent = `🧻 ${getAvailableRolls()}`;
  }
  const hote = $id('mascot');
  if (!hote) return;
  const m = mascotMood(state.logs);
  const activeAccessory = typeof resolveActiveAccessory === 'function'
    ? resolveActiveAccessory(m.accessory)
    : m.accessory;
  const niv = mascotLevel(state.logs.length);
  hote.innerHTML = mascotSVG(m.mood, activeAccessory);
  const costumeLabel = $id('mascot-costume-label');
  if (costumeLabel) {
    const meta = typeof costumeMeta === 'function' ? costumeMeta(activeAccessory) : null;
    costumeLabel.textContent = meta ? `${meta.emoji} ${meta.name}` : '';
  }
  const bulle = $id('mascot-message');
  if (bulle) bulle.textContent = m.message;
  const lvl = $id('mascot-level');
  if (lvl) {
    const throne = typeof throneStage === 'function' ? throneStage(niv.level) : null;
    const throneBadge = throne
      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style="background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--accent)">${throne.emoji} ${esc(throne.label)}</span>`
      : '';
    const waterToday = typeof getWaterToday === 'function' ? getWaterToday() : 0;
    const quests = typeof dailyQuests === 'function' ? dailyQuests(state.logs, waterToday) : [];
    const questsDone = quests.filter(q => q.done).length;
    const questsHTML = quests.length
      ? `
      <div class="mt-2.5 pt-2.5 border-t" style="border-color:var(--card-border)">
        <div class="flex items-center justify-between text-[11px] font-bold mb-1.5">
          <span>🎯 Quêtes du jour</span>
          <span class="opacity-70">${questsDone}/${quests.length}</span>
        </div>
        <div class="grid grid-cols-3 gap-1.5">
          ${quests.map(q => `
            <div class="px-2 py-1 rounded-xl text-[10px] font-semibold flex items-center gap-1 truncate"
                 style="${q.done
                   ? 'background:color-mix(in srgb,#10b981 16%,transparent);color:#059669'
                   : 'background:rgba(128,128,128,0.10);opacity:0.8'}">
              <span>${q.done ? '✅' : q.emoji}</span>
              <span class="truncate">${esc(q.label)}</span>
            </div>`).join('')}
        </div>
      </div>`
      : '';
    lvl.innerHTML = `
      <div class="flex items-center justify-between gap-2 text-[11px] font-bold opacity-70">
        <span class="flex items-center gap-1.5 flex-wrap">Niv. ${niv.level} · ${esc(niv.name)} ${throneBadge}</span>
        <span>${niv.next ? `encore ${niv.remaining} pour « ${esc(niv.next)} »` : 'niveau max !'}</span>
      </div>
      <div class="w-full rounded-full overflow-hidden mt-1" style="height:6px;background:rgba(0,0,0,0.08)">
        <div style="width:${Math.round(niv.progress * 100)}%;height:100%;border-radius:99px;background:var(--accent);transition:width .6s"></div>
      </div>${questsHTML}`;
  }
  const { current, pending } = streakDetails();
  const serieEl = $id('home-streak');
  if (serieEl) {
    serieEl.textContent = current || pending || 0;
    serieEl.closest('.home-stat')?.classList.toggle('streak-pending', !current && pending > 0);
  }
  renderWrappedReminder();
}

const renderHomeToday = renderHomeCard;

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
  // Toucher la mascotte fait défiler ses costumes débloqués et la fait sauter.
  $id('mascot')?.addEventListener('click', () => {
    const hote = $id('mascot');
    if (!hote) return;
    if (typeof cycleMascotCostume === 'function') {
      const nextAcc = cycleMascotCostume();
      const m = mascotMood(state.logs);
      hote.innerHTML = mascotSVG(m.mood, nextAcc);
      const costumeLabel = $id('mascot-costume-label');
      if (costumeLabel && typeof costumeMeta === 'function') {
        const meta = costumeMeta(nextAcc);
        costumeLabel.textContent = meta ? `${meta.emoji} ${meta.name}` : '';
      }
      if ($id('wardrobe-container') && typeof renderWardrobePanel === 'function') {
        renderWardrobePanel();
      }
    }
    const svg = hote.querySelector?.('.mascot-svg');
    if (svg) {
      svg.classList?.remove('mascot-jump');
      void svg.getBoundingClientRect?.();   // relance l'animation
      svg.classList?.add('mascot-jump');
    }
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
