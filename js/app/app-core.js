// ============================================================
//  app-core.js
//  helpers, persistance localStorage, etat global, amorcage
//  Extrait du bloc <script> de index.html. L'ordre de chargement
//  est significatif : ces fichiers partagent la portee globale.
// ============================================================

// ===================================================
//  UTILS
// ===================================================
const $id = id => document.getElementById(id);

// Charge un script à la demande, une seule fois même si appelé plusieurs fois.
// Sert aux dépendances lourdes qui ne concernent qu'un écran précis (QRCode).
const _scriptPromises = {};
window.loadScriptOnce = function(src) {
  if (!_scriptPromises[src]) {
    _scriptPromises[src] = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.onload  = () => resolve();
      el.onerror = () => { delete _scriptPromises[src]; reject(new Error('Chargement impossible : ' + src)); };
      document.head.appendChild(el);
    });
  }
  return _scriptPromises[src];
};
const $debug = msg => {
  const el = $id('debug-box');
  if (!el) return;
  el.textContent = (String(msg) + '\n' + el.textContent).slice(0, 3000);
};
window.addEventListener('error', e => $debug('❌ ' + e.message));
window.addEventListener('unhandledrejection', e => $debug('❌ promise: ' + (e.reason?.message || e.reason)));

// ===================================================
//  STORAGE
// ===================================================
const STORAGE_KEY = 'cacaTracker.v2';
let _memFallback = null;

function lsAvailable() {
  try { localStorage.setItem('__t','1'); localStorage.removeItem('__t'); return true; } catch { return false; }
}
const LS_OK = lsAvailable();

function loadState() {
  try {
    const raw = LS_OK ? localStorage.getItem(STORAGE_KEY) : null;
    return raw ? JSON.parse(raw) : _memFallback;
  } catch(e) { $debug('load err: ' + e.message); return null; }
}

function saveState(s) {
  try {
    if (LS_OK) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else _memFallback = s;
  } catch(e) { $debug('save err: ' + e.message); _memFallback = s; }
}

// ===================================================
//  STATE
// ===================================================
let state = { logs: [], theme: 'default' };
let selectedTexture = null;
let selectedColor   = null;
let selectedMood    = null;
let weekChart = null;

// ===================================================
//  INIT
// ===================================================
document.addEventListener('DOMContentLoaded', () => {
  // Load
  const saved = loadState();
  if (saved?.logs && Array.isArray(saved.logs)) state = { ...state, ...saved };

  // Theme
  applyTheme(state.theme || 'default');
  applyAutoNight();
  setInterval(() => { applyAutoNight(); checkCustomReminder(); }, 60000);

  // Sticky header
  applyStickyHeader();

  // Datetime max
  refreshRetroMax();

  // Status
  $id('status-pill') && ($id('status-pill').textContent = [LS_OK ? 'localStorage ✅' : 'Mémoire ⚠️', navigator.onLine ? '🌐' : '✈️'].join(' '));

  // Events
  setupEvents();
  buildBadgesGrid();
  renderAll();
  initChart();

  // PWA
  registerSW();
  showInstallBanner();

  // Modules v2.0 init
  window.JokesModule?.displayDailyJoke();

  // Sons : injecter le contrôleur dans l'onglet Historique
  const soundSettingsEl = $id('sound-settings');
  if (soundSettingsEl && typeof createSoundControl === 'function') {
    soundSettingsEl.innerHTML = createSoundControl();
  }

  // Vérifier si une notification de rappel doit être affichée
  checkPoopNotification();

  // Supabase : écouter l'événement de récupération de mot de passe
  // (doit être enregistré AVANT initAuthListener pour ne pas rater l'événement)
  window.addEventListener('supabase-password-recovery', () => {
    $id('new-password-modal').classList.remove('hidden');
  });

  // Supabase : écouter INITIAL_SESSION (plus fiable que getSession sur mobile/PWA)
  // L'event est dispatché par initAuthListener dès que le SDK est prêt
  window.addEventListener('supabase-init', async (e) => {
    const profile = e.detail;
    if (profile) {
      updateUserBadge(profile);
      await syncCloudData();
      $debug('☁️ session restored via INITIAL_SESSION: ' + profile.username);
    }
  }, { once: true });

  // Démarrer le listener EN PREMIER (déclenche INITIAL_SESSION + PASSWORD_RECOVERY)
  if (window.SupabaseClient) {
    window.SupabaseClient.initAuthListener();
  }

  // Initialiser les features supplémentaires
  setupGoal();
  startCountdown();
  setupTimer();
  $id('wrapped-btn')?.addEventListener('click', openWrapped);
  $id('close-wrapped-btn')?.addEventListener('click', () => $id('wrapped-modal').classList.add('hidden'));
  $id('close-day-detail-btn')?.addEventListener('click', () => $id('day-detail-modal').classList.add('hidden'));
  $id('share-stats-btn')?.addEventListener('click', shareStats);
  $id('share-app-btn')?.addEventListener('click', shareApp);
  $id('export-ical-btn')?.addEventListener('click', exportIcal);

  // Auto-join via ?join=CODE in URL
  const urlJoinCode = new URLSearchParams(window.location.search).get('join');
  if (urlJoinCode) {
    // Remove the param from URL to avoid double-join on refresh
    history.replaceState({}, '', window.location.pathname);
    // Wait for session to restore, then try to join
    setTimeout(async () => {
      if (!window.SupabaseClient?.isLoggedIn()) {
        // Not logged in — go to social tab and prefill code
        switchTab('social');
        const inp = $id('invite-code-input');
        if (inp) inp.value = urlJoinCode.toUpperCase();
        alert('Connecte-toi pour rejoindre le groupe avec le code : ' + urlJoinCode.toUpperCase());
      } else {
        try {
          const g = await window.SupabaseClient.joinGroup(urlJoinCode);
          alert(`🎉 Tu as rejoint le groupe "${g.name}" !`);
          switchTab('social');
          window.SocialModule?.renderSocialTab();
        } catch(e) {
          alert('Impossible de rejoindre : ' + e.message);
        }
      }
    }, 1500);
  }

  // Présentation de bienvenue — en dernier, pour ne rien retarder au démarrage
  maybeShowOnboarding();

  $debug('✅ ready. logs=' + state.logs.length);
});
