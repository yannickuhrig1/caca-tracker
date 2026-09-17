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
  if (drawerInner) {
    drawerInner.style.background = drawerBg[theme] || '';
    // Fond des boutons collés en bas de la saisie (v2.18.0)
    drawerInner.style.setProperty('--drawer-bg', drawerBg[theme] || '#fff');
  }
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
  const h = new Date().getHours();
  const isNight = enabled && (h >= 22 || h < 7);
  // Thème du téléphone (v2.18.0, app-accueil.js) : même effet que la nuit,
  // sans toucher au thème choisi, qui revient dès que le téléphone repasse en clair.
  const sombreSysteme = typeof systemPrefersDark === 'function' && systemPrefersDark();
  if (isNight || sombreSysteme) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (enabled || typeof systemThemeEnabled === 'function' && systemThemeEnabled()) {
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
//  POOPMAP 🗺️ (reglages)
// ===================================================
function refreshPoopMapSettings() {
  const paires = [
    ['poopmap-geo-toggle',     'poopmap-geo-knob',     !!window.PoopMapModule?.geoEnabled()],
    ['poopmap-geocode-toggle', 'poopmap-geocode-knob', !!window.PoopMapModule?.geocodeEnabled()],
  ];
  paires.forEach(([btnId, knobId, on]) => {
    const btn  = $id(btnId);
    const knob = $id(knobId);
    if (btn)  btn.style.background = on ? '#4f46e5' : 'rgba(0,0,0,0.15)';
    if (knob) knob.style.transform = on ? 'translateX(20px)' : 'translateX(0)';
  });
}

window.togglePoopMapGeo = function() {
  const on = !!window.PoopMapModule?.geoEnabled();
  window.PoopMapModule?.setGeoEnabled(!on);
  refreshPoopMapSettings();
  refreshGeoButton();
};

window.togglePoopMapGeocode = function() {
  const on = !!window.PoopMapModule?.geocodeEnabled();
  window.PoopMapModule?.setGeocodeEnabled(!on);
  refreshPoopMapSettings();
};

// Rattrape les positions enregistrees avant l'activation du geocodage.
window.fillPoopMapZones = async function() {
  const mod = window.PoopMapModule;
  const btn = $id('poopmap-fill-btn');
  if (!mod) return;
  const manquantes = state.logs.filter(l => mod.hasGeo(l) && !mod.hasZone(l));
  if (!manquantes.length) { window.UI.toast('Toutes tes positions sont déjà nommées.', 'info'); return; }
  if (!navigator.onLine) { window.UI.toast('Il faut être connectée pour interroger OpenStreetMap.', 'error'); return; }

  btn.disabled = true;
  try {
    // Une requête par seconde côté Nominatim : on annonce l'attente.
    const res = await mod.fillMissingZones(state.logs, {
      onProgress: (fait, total) => { btn.textContent = `🌍 ${fait}/${total}…`; }
    });
    saveState(state);
    renderAll();
    if ($id('poopmap-container')) mod.renderCard(state.logs, $id('poopmap-container'));
    if (window.SupabaseClient?.isLoggedIn() && navigator.onLine) {
      const modifiees = state.logs.filter(l => mod.hasZone(l));
      await Promise.allSettled(modifiees.map(l => window.SupabaseClient.savePoopCloud(l)));
    }
    window.UI.toast(
      `${res.resolus} position${res.resolus > 1 ? 's' : ''} nommée${res.resolus > 1 ? 's' : ''}` +
      (res.restants ? ` — ${res.restants} restante${res.restants > 1 ? 's' : ''}, relance pour la suite` : ''),
      'success', 5000);
  } catch (e) {
    window.UI.toast('Échec : ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🌍 Nommer les positions déjà enregistrées';
  }
};

// Efface les coordonnees de toutes les entrees — les lieux, eux, restent.
window.forgetPoopMapPositions = async function() {
  const concernes = state.logs.filter(l => window.PoopMapModule?.hasGeo(l));
  if (!concernes.length) { window.UI.toast('Aucune position enregistrée.', 'info'); return; }
  const ok = await window.UI.confirm(
    `Effacer la position de ${concernes.length} caca${concernes.length > 1 ? 's' : ''} ? Les lieux sont conservés.`,
    { title: '🧹 Effacer les positions', okLabel: 'Effacer', danger: true });
  if (!ok) return;

  const n = window.PoopMapModule.forgetAllPositions(state.logs);
  saveState(state);
  renderAll();
  if ($id('poopmap-container')) window.PoopMapModule.renderCard(state.logs, $id('poopmap-container'));

  // Le cloud garde une copie : on repousse les entrees vidées.
  if (window.SupabaseClient?.isLoggedIn() && navigator.onLine) {
    await Promise.allSettled(concernes.map(l => window.SupabaseClient.savePoopCloud(l)));
  } else if (window.SupabaseClient?.isLoggedIn()) {
    concernes.forEach(l => enqueueOffline({ type: 'add', poop: l }));
  }
  window.UI.toast(`${n} position${n > 1 ? 's' : ''} effacée${n > 1 ? 's' : ''}`, 'success');
};

// ===================================================
//  ORDRE DES TUILES DE L'ONGLET STATS
// ===================================================
// Chaque tuile porte un data-tile ; l'ordre choisi est mémorisé et rejoué en
// déplaçant les éléments du DOM. Des boutons ↑ ↓ plutôt qu'un glisser-déposer :
// au doigt, sur une page qui défile, le glisser rate une fois sur deux.
const STATS_TILES = [
  { id: 'freq',          label: '💩 Fréquence quotidienne' },
  { id: 'transit',       label: '⏱️ Transit intestinal' },
  { id: 'textures',      label: '🎨 Répartition des textures' },
  { id: 'month-compare', label: '📆 Comparatif mensuel' },
  { id: 'health',        label: '🏥 Score de santé' },
  { id: 'records',       label: '🏆 Records personnels' },
  { id: 'duration',      label: '⏱️ Durée des séances' },
  { id: 'insights',      label: '🔍 Ce que j\'ai remarqué' },
  { id: 'bristol',       label: '🔬 Échelle de Bristol' },
  { id: 'yearly',        label: '📅 Bilan année / mois' },
  { id: 'poopmap',       label: '🗺️ PoopMap' },
  { id: 'calendar',      label: '📅 Calendrier mensuel' },
  { id: 'charts',        label: '📈 Graphiques' },
  { id: 'funfacts',      label: '🌟 Le saviez-vous ?' },
];
const STATS_ORDER_KEY = 'stats.tileOrder';
let statsEditing = false;

/** Ordre mémorisé, complété par les tuiles ajoutées depuis (nouvelles versions). */
function statsOrder() {
  let enregistre = [];
  try { enregistre = JSON.parse(localStorage.getItem(STATS_ORDER_KEY) || '[]'); } catch {}
  const connues = STATS_TILES.map(t => t.id);
  const valide = enregistre.filter(id => connues.includes(id));
  return [...valide, ...connues.filter(id => !valide.includes(id))];
}

function applyStatsOrder() {
  const hote = $id('stats-tiles');
  if (!hote) return;
  statsOrder().forEach(id => {
    const tuile = hote.querySelector(`[data-tile="${id}"]`);
    if (tuile) hote.appendChild(tuile);   // appendChild déplace, il ne copie pas
  });
}

window.moveStatsTile = function(id, delta) {
  const ordre = statsOrder();
  const i = ordre.indexOf(id);
  const j = i + delta;
  if (i === -1 || j < 0 || j >= ordre.length) return;
  [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
  try { localStorage.setItem(STATS_ORDER_KEY, JSON.stringify(ordre)); } catch {}
  applyStatsOrder();
  renderStatsEditBars();
};

window.resetStatsOrder = function() {
  try { localStorage.removeItem(STATS_ORDER_KEY); } catch {}
  applyStatsOrder();
  renderStatsEditBars();
};

window.toggleStatsEdit = function() {
  statsEditing = !statsEditing;
  const btn = $id('stats-reorder-btn');
  if (btn) btn.textContent = statsEditing ? '✅ Terminé' : '🔀 Réorganiser';
  document.querySelectorAll('#stats-tiles .stats-tile').forEach(t => t.classList.toggle('tile-editing', statsEditing));
  renderStatsEditBars();
};

// Barres ↑ ↓ injectées en tête de chaque tuile pendant l'édition seulement :
// hors édition, elles n'existent pas dans le DOM.
function renderStatsEditBars() {
  document.querySelectorAll('#stats-tiles .tile-bar').forEach(b => b.remove());
  if (!statsEditing) return;

  const ordre = statsOrder();
  ordre.forEach((id, i) => {
    const tuile = document.querySelector(`#stats-tiles [data-tile="${id}"]`);
    if (!tuile) return;
    const meta = STATS_TILES.find(t => t.id === id);
    const barre = document.createElement('div');
    barre.className = 'tile-bar';
    barre.innerHTML = `
      <span class="tile-name">${meta ? meta.label : id}</span>
      <button type="button" class="tile-move" aria-label="Monter" ${i === 0 ? 'disabled' : ''}
              onclick="moveStatsTile('${id}',-1)">↑</button>
      <button type="button" class="tile-move" aria-label="Descendre" ${i === ordre.length - 1 ? 'disabled' : ''}
              onclick="moveStatsTile('${id}',1)">↓</button>`;
    tuile.prepend(barre);
  });
}

// ===================================================
//  TABS
// ===================================================
function switchTab(name) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  $id(name + '-tab')?.classList.add('active');
  // Active tous les boutons correspondants (sidebar desktop + bottom nav mobile)
  document.querySelectorAll(`.tab-btn[data-tab="${name}"]`).forEach(b => b.classList.add('active'));
  if (name === 'stats') { renderStats(); applyStatsOrder(); if (statsEditing) renderStatsEditBars(); }
  if (name === 'badges') { updateBadges(); updateBadgeRarity(); }
  if (name === 'admin') renderHistory();
  if (name === 'dashboard') renderDashboard();
  if (name === 'social') window.SocialModule?.renderSocialTab();
  if (name === 'settings') { setupNotifications(); setupCustomReminder(); applyStickyHeader(); refreshPoopMapSettings(); }
}

// ===================================================
//  DRAWER
// ===================================================
function openDrawer() {
  refreshRetroMax();
  refreshGeoButton();
  if (typeof refreshUsualButton === 'function') refreshUsualButton();
  $id('drawer').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

// Les lieux viennent de PoopMapModule.PLACES : une seule liste à maintenir.
function buildPlaceGrid() {
  const grid = $id('place-grid');
  if (!grid || !window.PoopMapModule) return;
  grid.innerHTML = window.PoopMapModule.PLACES.map(p => `
    <button type="button" class="place-btn p-2 rounded-[1rem] border-2 border-gray-200 text-center text-slate-800" data-place="${p.id}">
      ${p.emoji}<div class="text-xs mt-0.5">${p.label}</div>
    </button>`).join('');
}

// Le bouton 📍 n'existe que si la position est autorisée dans les Réglages.
function refreshGeoButton() {
  const btn = $id('geo-btn');
  if (!btn) return;
  btn.classList.toggle('hidden', !window.PoopMapModule?.geoEnabled());
  const status = $id('geo-status');
  if (status && !pendingGeo) status.textContent = '';
}

function selectPlace(id) {
  selectedPlace = id;
  document.querySelectorAll('.place-btn').forEach(b => {
    b.classList.toggle('border-amber-400', b.dataset.place === id);
    b.classList.toggle('bg-amber-50', b.dataset.place === id);
  });
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
  selectedPlace   = null;
  pendingGeo      = null;
  if (typeof setDurationInput === 'function') setDurationInput(null);
  if (typeof setHealthSelection === 'function') setHealthSelection([]);
  const santeDetails = $id('health-details');
  if (santeDetails) santeDetails.open = false;
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('border-amber-400','bg-amber-50'));
  document.querySelectorAll('.place-btn').forEach(b => b.classList.remove('border-amber-400','bg-amber-50'));
  const geoStatus = $id('geo-status');
  if (geoStatus) geoStatus.textContent = '';
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
