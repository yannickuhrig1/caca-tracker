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
    btn.style.background = enabled ? 'var(--accent)' : 'rgba(0,0,0,0.15)';
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
  if (btn) {
    btn.style.background = isSticky ? 'var(--accent)' : 'rgba(0,0,0,0.15)';
    btn.classList.toggle('is-on', isSticky);
    btn.setAttribute('aria-checked', String(isSticky));
  }
  if (knob) knob.style.transform = isSticky ? 'translateX(20px)' : 'translateX(0)';
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
    if (btn) {
      btn.style.background = on ? 'var(--accent)' : 'rgba(0,0,0,0.15)';
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-checked', String(on));
    }
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
const STATS_POLE_KEY  = 'stats.activePole';
const STATS_POLES     = ['all', 'synthese', 'sante', 'carte', 'rythme'];
let statsEditing = false;

function getActiveStatsPole() {
  try {
    const saved = localStorage.getItem(STATS_POLE_KEY);
    return STATS_POLES.includes(saved) ? saved : 'all';
  } catch {
    return 'all';
  }
}

function applyStatsPole(pole = getActiveStatsPole()) {
  const target = STATS_POLES.includes(pole) ? pole : 'all';
  document.querySelectorAll('#stats-poles-bar .stats-pole-chip').forEach(btn => {
    const on = btn.dataset.poleFilter === target;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', String(on));
  });
  document.querySelectorAll('#stats-tiles .stats-tile[data-pole]').forEach(tile => {
    const visible = statsEditing || target === 'all' || tile.dataset.pole === target;
    tile.classList.toggle('hidden', !visible);
  });
}

function switchStatsPole(pole) {
  const target = STATS_POLES.includes(pole) ? pole : 'all';
  try { localStorage.setItem(STATS_POLE_KEY, target); } catch {}
  applyStatsPole(target);
  return target;
}
window.switchStatsPole = switchStatsPole;

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
  applyStatsPole(getActiveStatsPole());
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
// Les onglets regroupés sous « Moi » : quand on est sur l'un d'eux, c'est le
// bouton « Moi » qui reste surligné (la barre de sous-onglets vit dans chaque
// section, donc seule celle de la section active est visible).
const MOI_SUBTABS = ['stats', 'history', 'badges'];

function switchTab(name) {
  // « moi » est un raccourci vers l'onglet par défaut du hub (les stats).
  const target = name === 'moi' ? 'stats' : name;
  const isMoi = MOI_SUBTABS.includes(target);
  const navName = isMoi ? 'moi' : target;

  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.bottom-nav .tab-btn, #desktop-sidebar .tab-btn, .tab-btn').forEach(b => b.classList.remove('active'));
  $id(target + '-tab')?.classList.add('active');
  // Active tous les boutons correspondants (sidebar desktop + bottom nav mobile)
  document.querySelectorAll(`.bottom-nav .tab-btn[data-tab="${navName}"], #desktop-sidebar .tab-btn[data-tab="${navName}"], .tab-btn[data-tab="${navName}"]`)
    .forEach(b => b.classList.add('active'));

  // Barre partagée du hub « Moi » : visible uniquement sur Stats / Historique / Badges
  $id('moi-header-bar')?.classList.toggle('hidden', !isMoi);
  document.querySelectorAll('.moi-subtab').forEach(b => {
    const on = b.dataset.moi === target;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });

  if (target === 'stats') { renderStats(); applyStatsOrder(); applyStatsPole(getActiveStatsPole()); if (statsEditing) renderStatsEditBars(); }
  if (target === 'badges') { updateBadges(); updateBadgeRarity(); if (typeof renderWardrobePanel === 'function') renderWardrobePanel(); }
  if (target === 'history') renderHistory();
  if (target === 'dashboard') { renderDashboard(); if (typeof renderHydrationTile === 'function') renderHydrationTile(); }
  if (target === 'social') window.SocialModule?.renderSocialTab();
  if (target === 'settings') {
    setupNotifications();
    setupCustomReminder();
    applyStickyHeader();
    refreshPoopMapSettings();
    refreshSettingsProfileCard();
    refreshLiveThroneToggle();
  }
}

// ===================================================
//  DRAWER
// ===================================================
function openDrawer() {
  refreshRetroMax();
  refreshGeoButton();
  if (typeof refreshUsualButton === 'function') refreshUsualButton();
  if (typeof refreshMaisRow === 'function') refreshMaisRow();
  if (typeof switchSaisieMode === 'function') switchSaisieMode('express');
  if (typeof preselectSuggestedWaterTag === 'function') preselectSuggestedWaterTag();
  if (typeof updateSelectedColorLabel === 'function') updateSelectedColorLabel(selectedColor);
  if (typeof refreshSaisieSanteBadge === 'function') refreshSaisieSanteBadge();
  const drawerInner = $id('drawer-inner');
  if (drawerInner) {
    drawerInner.style.transform = '';
    drawerInner.style.transition = '';
    drawerInner.scrollTop = 0;
  }
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

// Le bouton 📍 reste toujours visible dans la saisie Express.
function refreshGeoButton() {
  const btn = $id('geo-btn');
  if (!btn) return;
  btn.classList.remove('hidden');
  const hasGeo = !!(pendingGeo && typeof pendingGeo.lat === 'number' && typeof pendingGeo.lon === 'number'
    && !isNaN(pendingGeo.lat) && !isNaN(pendingGeo.lon));
  btn.textContent = hasGeo ? '📍 Position enregistrée ✅' : '📍 Ajouter ma position';
  const status = $id('geo-status');
  if (status) {
    status.textContent = hasGeo ? `${pendingGeo.lat.toFixed(4)}, ${pendingGeo.lon.toFixed(4)}` : '';
  }
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
  const drawerInner = $id('drawer-inner');
  if (drawerInner) {
    drawerInner.style.transform = '';
    drawerInner.style.transition = '';
  }
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
  if (typeof refreshMaisRow === 'function') refreshMaisRow();
  if (typeof updateSelectedColorLabel === 'function') updateSelectedColorLabel(null);
  if (typeof refreshSaisieSanteBadge === 'function') refreshSaisieSanteBadge();
  if (typeof switchSaisieMode === 'function') switchSaisieMode('express');
  const santeDetails = $id('health-details');
  if (santeDetails) santeDetails.open = true;
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('border-amber-400','bg-amber-50'));
  document.querySelectorAll('.place-btn').forEach(b => b.classList.remove('border-amber-400','bg-amber-50'));
  refreshGeoButton();
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

// ===================================================
//  GUIDE UTILISATEUR MODAL (#guide-modal)
// ===================================================
function filterGuideSections(query = '') {
  const q = String(query || '').trim().toLowerCase();
  const container = $id('guide-sections');
  if (!container) return;
  let visibleCount = 0;
  container.querySelectorAll('.guide-section').forEach(sec => {
    const match = !q || (sec.textContent || '').toLowerCase().includes(q);
    sec.classList.toggle('hidden', !match);
    if (q) sec.open = match;
    else sec.open = false;
    if (match) visibleCount++;
  });
  let emptyEl = $id('guide-empty');
  if (q && visibleCount === 0) {
    if (!emptyEl) {
      emptyEl = document.createElement('div');
      emptyEl.id = 'guide-empty';
      emptyEl.className = 'text-xs text-center opacity-60 py-6';
      emptyEl.textContent = 'Aucune section ne correspond à ta recherche.';
      container.appendChild(emptyEl);
    }
    emptyEl.classList.remove('hidden');
  } else if (emptyEl) {
    emptyEl.classList.add('hidden');
  }
}

function openGuideModal() {
  const modal = $id('guide-modal');
  if (!modal) return;
  const search = $id('guide-search');
  if (search) search.value = '';
  filterGuideSections('');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeGuideModal() {
  const modal = $id('guide-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  if ($id('drawer')?.classList.contains('hidden')) {
    document.body.style.overflow = '';
  }
}

// ===================================================
//  CARTE PROFIL RÉGLAGES & STATUT LIVE (v3.0)
// ===================================================
function refreshSettingsProfileCard() {
  const card = $id('settings-profile-card');
  if (!card) return;
  const profile = window.SupabaseClient?.getCurrentProfile?.() || null;
  const avEl = $id('settings-profile-avatar');
  const nameEl = $id('settings-profile-name');
  const subEl = $id('settings-profile-sub');

  const avatarVal = profile
    ? (profile.avatar || '💩')
    : ((typeof LS_OK === 'undefined' || LS_OK) ? (localStorage.getItem('profile.avatar') || '👤') : '👤');
  if (avEl) {
    if (typeof setAvatarEl === 'function') setAvatarEl(avEl, avatarVal);
    else avEl.textContent = avatarVal;
  }
  if (nameEl) {
    nameEl.textContent = profile?.username || 'Mon Profil';
  }
  if (subEl) {
    subEl.textContent = profile
      ? (profile.email || '☁️ Compte synchronisé')
      : 'Mode local · Avatar, 16 thèmes & synchro';
  }
}

function refreshLiveThroneToggle() {
  const mod = window.SocialLiveModule;
  const on = mod?.isLiveThroneEnabled ? !!mod.isLiveThroneEnabled() : false;
  const btn = $id('live-throne-toggle');
  const knob = $id('live-throne-knob');
  if (btn) {
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
    btn.classList.toggle('is-on', on);
    btn.style.background = on ? 'var(--accent)' : 'rgba(0,0,0,0.15)';
  }
  if (knob) {
    knob.style.transform = on ? 'translateX(20px)' : 'translateX(0)';
  }
}

function setupUiV3() {
  // Pôles Stats
  $id('stats-poles-bar')?.addEventListener('click', e => {
    const chip = e.target.closest('.stats-pole-chip');
    if (!chip) return;
    switchStatsPole(chip.dataset.poleFilter);
  });
  applyStatsPole(getActiveStatsPole());

  // Guide complet modal
  $id('open-guide-btn')?.addEventListener('click', openGuideModal);
  $id('close-guide-modal')?.addEventListener('click', closeGuideModal);
  $id('guide-modal')?.addEventListener('click', e => {
    const modal = $id('guide-modal');
    if (e.target === modal || e.target === modal?.firstElementChild) closeGuideModal();
  });
  const guideSearch = $id('guide-search');
  if (guideSearch) {
    guideSearch.addEventListener('input', () => filterGuideSections(guideSearch.value));
    guideSearch.addEventListener('search', () => filterGuideSections(guideSearch.value));
  }

  // Carte Profil dans Réglages -> ouverture directe sur Avatar / Thème / Compte
  $id('settings-profile-card')?.addEventListener('click', e => {
    const tabBtn = e.target.closest('[data-open-profile-tab]');
    const targetTab = tabBtn ? tabBtn.dataset.openProfileTab : 'avatar';
    if (!tabBtn && e.target.closest('button')) return;
    if (typeof openProfileModal === 'function') openProfileModal();
    if (typeof showProfileTab === 'function' && ['avatar', 'theme', 'compte'].includes(targetTab)) {
      showProfileTab(targetTab);
    }
  });

  // Switch Statut live Sur le trône
  $id('live-throne-toggle')?.addEventListener('click', () => {
    const mod = window.SocialLiveModule;
    if (!mod) return;
    const next = !mod.isLiveThroneEnabled();
    mod.setLiveThroneEnabled(next);
    refreshLiveThroneToggle();
    window.UI?.toast?.(
      next
        ? 'Statut live « 🚽 Sur le trône » activé pendant ton chrono !'
        : 'Statut live « 🚽 Sur le trône » désactivé',
      'info'
    );
  });

  refreshSettingsProfileCard();
  refreshLiveThroneToggle();
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('DOMContentLoaded', setupUiV3);
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('supabase-init', refreshSettingsProfileCard);
}
