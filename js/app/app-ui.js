// ============================================================
//  app-ui.js
//  themes, mode nuit auto, header sticky, onglets, drawer
//  Extrait du bloc <script> de index.html. L'ordre de chargement
//  est significatif : ces fichiers partagent la portee globale.
// ============================================================

// ===================================================
//  THEME
// ===================================================
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'default' ? '' : theme);
  const metaColor = {
    default:'#d97706', dark:'#1e1b4b', medical:'#059669',
    kawaii:'#e91e8c', foret:'#2e7d32', ocean:'#0277bd',
    sunset:'#ff6b6b', galaxy:'#6a0572', sakura:'#e91e8c',
    mint:'#00b894', lavande:'#7c3aed', 'rose-gold':'#c97b6a',
    tropicale:'#00b8a9', nordique:'#2c5f8a', automne:'#b45309', neon:'#00ff88'
  };
  $id('theme-color-meta').setAttribute('content', metaColor[theme] || '#d97706');

  // Update active dot
  document.querySelectorAll('[data-theme-btn]').forEach(b => {
    b.classList.toggle('selected', b.dataset.themeBtn === theme);
  });

  // Drawer bg selon le thème
  const drawerBg = {
    dark:'#1e1b4b', medical:'#f0fdf4', kawaii:'#fce4ec',
    foret:'#f1f8e9', ocean:'#e0f7fa', sunset:'#ffd6a5',
    galaxy:'#0d0221', sakura:'#ffb7c5', mint:'#c8f7c5',
    lavande:'#e6d9f7', 'rose-gold':'#f9e4e8', tropicale:'#b3ffec',
    nordique:'#dce8f5', automne:'#fde8c8', neon:'#000000'
  };
  const drawerInner = $id('drawer-inner');
  if (drawerInner) drawerInner.style.background = drawerBg[theme] || '';
}

// ===================================================
//  MODE NUIT AUTO 🌙
// ===================================================
function applyAutoNight() {
  const enabled = localStorage.getItem('autoNightMode') === 'true';
  const knob = $id('auto-night-knob');
  const btn  = $id('auto-night-toggle');
  if (btn) {
    btn.style.background = enabled ? '#4f46e5' : 'rgba(0,0,0,0.15)';
    if (knob) knob.style.transform = enabled ? 'translateX(20px)' : 'translateX(0)';
  }
  if (!enabled) return;
  const h = new Date().getHours();
  const isNight = h >= 22 || h < 7;
  if (isNight) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    applyTheme(state.theme || 'default');
  }
}

window.toggleAutoNight = function() {
  const current = localStorage.getItem('autoNightMode') === 'true';
  localStorage.setItem('autoNightMode', !current);
  applyAutoNight();
};

// ===================================================
//  STICKY HEADER 📌
// ===================================================
function applyStickyHeader() {
  const isSticky = localStorage.getItem('stickyHeader') !== 'false';
  const hdr = document.querySelector('header.app-header');
  if (hdr) {
    if (isSticky) { hdr.classList.add('sticky','top-0','z-50'); hdr.classList.remove('relative'); }
    else { hdr.classList.remove('sticky','top-0','z-50'); hdr.classList.add('relative'); }
  }
  const btn  = $id('sticky-header-toggle');
  const knob = $id('sticky-header-knob');
  if (btn)  btn.style.background  = isSticky ? '#4f46e5' : 'rgba(0,0,0,0.15)';
  if (knob) knob.style.transform  = isSticky ? 'translateX(20px)' : 'translateX(0)';
}

window.toggleStickyHeader = function() {
  const isSticky = localStorage.getItem('stickyHeader') !== 'false';
  localStorage.setItem('stickyHeader', String(!isSticky));
  applyStickyHeader();
};

// ===================================================
//  TABS
// ===================================================
function switchTab(name) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  $id(name + '-tab')?.classList.add('active');
  // Active tous les boutons correspondants (sidebar desktop + bottom nav mobile)
  document.querySelectorAll(`.tab-btn[data-tab="${name}"]`).forEach(b => b.classList.add('active'));
  if (name === 'stats') renderStats();
  if (name === 'badges') updateBadges();
  if (name === 'admin') renderHistory();
  if (name === 'dashboard') renderDashboard();
  if (name === 'social') window.SocialModule?.renderSocialTab();
  if (name === 'settings') { setupNotifications(); setupCustomReminder(); applyStickyHeader(); }
}

// ===================================================
//  DRAWER
// ===================================================
function openDrawer() {
  refreshRetroMax();
  $id('drawer').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  $id('drawer').classList.add('hidden');
  document.body.style.overflow = '';
  // Reset — repasse aussi le drawer en mode création s'il servait à modifier
  editingId = null;
  $id('drawer-title').textContent    = 'Nouveau 💩';
  $id('drawer-subtitle').textContent = 'Texture + couleur obligatoires';
  $id('save-poop').innerHTML         = '💥 Valider';
  $id('comment').value = '';
  selectedTexture = null;
  selectedColor   = null;
  selectedMood    = null;
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('border-amber-400','bg-amber-50'));
  $id('retro-chk').checked = false;
  $id('retro-date-wrap').classList.add('hidden');
  $id('retro-toggle-row').classList.remove('hidden');
  $id('retro-date-label').textContent = 'Date et heure du caca :';
  document.querySelectorAll('.texture-btn').forEach(b => b.classList.remove('border-amber-500', 'bg-amber-100', 'selected'));
  document.querySelectorAll('.color-btn').forEach(b => { b.style.transform = ''; b.style.outline = ''; });
  $id('texture-err')?.classList.add('hidden');
  $id('color-err')?.classList.add('hidden');
}

function refreshRetroMax() {
  const inp = $id('retro-date');
  if (!inp) return;
  // "now" in local timezone for datetime-local input
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  const localIso = new Date(now - offset).toISOString().slice(0, 16);
  inp.max = localIso;
  if (!inp.value) inp.value = localIso;
}
