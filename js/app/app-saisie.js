// ============================================================
//  app-saisie.js
//  ecran de saisie (v2.18.0) : duree, carnet de sante, « comme
//  d'habitude », textures illustrees, vibrations, raccourcis d'app
//  Charge apres app-sante.js et avant app-entries.js.
// ============================================================

// Étiquettes cochées dans le drawer (ids de HEALTH_TAGS)
let selectedHealth = new Set();

// ===================================================
//  VIBRATIONS 📳
// ===================================================
// Android seulement : Safari iOS n'implémente pas navigator.vibrate. Un
// réglage permet de les couper ; elles sont actives par défaut.
const HAPTICS_KEY = 'saisie.haptics';

function hapticsEnabled() {
  try { return localStorage.getItem(HAPTICS_KEY) !== 'off'; } catch { return true; }
}

function haptic(pattern = 12) {
  if (!hapticsEnabled() || typeof navigator === 'undefined' || !navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch {}
}

window.toggleHaptics = function() {
  try { localStorage.setItem(HAPTICS_KEY, hapticsEnabled() ? 'off' : 'on'); } catch {}
  refreshHapticsToggle();
  haptic([20, 40, 20]);
};

function refreshHapticsToggle() {
  const on = hapticsEnabled();
  const btn = $id('haptics-toggle'), knob = $id('haptics-knob');
  if (btn) {
    btn.style.background = on ? 'var(--accent)' : 'rgba(0,0,0,0.15)';
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-checked', String(on));
  }
  if (knob) knob.style.transform = on ? 'translateX(20px)' : 'translateX(0)';
}

// ===================================================
//  TEXTURES ILLUSTRÉES 🎨
// ===================================================
// Dessins maison en SVG : plus lisibles qu'un emoji, identiques sur iPhone et
// Android, et aucune dépendance. `currentColor` suit le texte du bouton.
const TEXTURE_ART = {
  normal: `
    <ellipse cx="24" cy="38" rx="17" ry="6" fill="#8B5A2B"/>
    <ellipse cx="24" cy="29" rx="13" ry="6" fill="#9C6B3A"/>
    <ellipse cx="24" cy="20.5" rx="9" ry="5" fill="#A97745"/>
    <path d="M24 9c3 1 5 4 3 7h-6c-1.5-2.5 0-5.5 3-7Z" fill="#B5834F"/>
    <circle cx="19.5" cy="29" r="2" fill="#fff"/><circle cx="28.5" cy="29" r="2" fill="#fff"/>
    <circle cx="19.8" cy="29.3" r="1" fill="#111"/><circle cx="28.8" cy="29.3" r="1" fill="#111"/>
    <path d="M20 34c2.5 2 5.5 2 8 0" stroke="#3b2210" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  dur: `
    <circle cx="13" cy="33" r="6" fill="#6B4423"/>
    <circle cx="25" cy="36" r="6.5" fill="#5C3A1E"/>
    <circle cx="36" cy="31" r="5.5" fill="#6B4423"/>
    <circle cx="20" cy="23" r="5" fill="#7A4E2A"/>
    <circle cx="31" cy="21" r="4.5" fill="#5C3A1E"/>
    <path d="M10 31l2 1M23 34l2-1M34 29l1 2M18 21l2 1M29 20l2 1" stroke="#3b2210" stroke-width="1.2" stroke-linecap="round"/>`,
  mou: `
    <path d="M7 36c0-8 7-10 10-15 3-5 11-5 14 0 3 5 10 7 10 15 0 5-7 6-17 6S7 41 7 36Z" fill="#B07A45"/>
    <path d="M14 42c0 3 3 3 3 0M31 42c0 4 3 4 3 0" stroke="#B07A45" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <ellipse cx="19" cy="27" rx="4" ry="2" fill="#C99463"/>`,
  spray: `
    <circle cx="24" cy="26" r="7" fill="#A87444"/>
    <circle cx="11" cy="17" r="3" fill="#A87444"/><circle cx="37" cy="15" r="3.5" fill="#A87444"/>
    <circle cx="9" cy="33" r="2.5" fill="#A87444"/><circle cx="39" cy="34" r="2.8" fill="#A87444"/>
    <circle cx="17" cy="8" r="1.8" fill="#A87444"/><circle cx="30" cy="7" r="2" fill="#A87444"/>
    <circle cx="24" cy="42" r="2.4" fill="#A87444"/><circle cx="16" cy="40" r="1.6" fill="#A87444"/>`,
  liquide: `
    <path d="M24 6c5 9 11 14 11 21a11 11 0 0 1-22 0c0-7 6-12 11-21Z" fill="#C08A52"/>
    <path d="M5 40c4-3 7-3 10 0s7 3 10 0 7-3 10 0 5 2 8 0" stroke="#C08A52" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <ellipse cx="20" cy="26" rx="2.5" ry="4" fill="#D9A774"/>`,
  explosif: `
    <path d="M24 3l4 9 9-5-3 10 10 2-9 6 6 8-10-2-1 10-6-8-6 8-1-10-10 2 6-8-9-6 10-2-3-10 9 5Z" fill="#F59E0B"/>
    <path d="M24 12l2.5 6 6-3-2 6.5 6.5 1.5-6 4 4 5-6.5-1.3-.5 6.3-4-5-4 5-.5-6.3-6.5 1.3 4-5-6-4 6.5-1.5-2-6.5 6 3Z" fill="#EF4444"/>
    <ellipse cx="24" cy="27" rx="6" ry="4" fill="#8B5A2B"/>`,
};

function buildTextureArt() {
  document.querySelectorAll('.texture-btn').forEach(btn => {
    const art = TEXTURE_ART[btn.dataset.texture];
    const slot = btn.querySelector('.tex-art');
    if (art && slot) slot.innerHTML = `<svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">${art}</svg>`;
  });
}

// ===================================================
//  DURÉE ⏱️
// ===================================================
function setDurationInput(seconds) {
  const n = validDuration(seconds);
  const min = $id('duration-min'), sec = $id('duration-sec');
  if (!min || !sec) return;
  min.value = n === null ? '' : Math.floor(n / 60);
  sec.value = n === null ? '' : n % 60;
  refreshDurationHint();
}

/** Secondes saisies, ou null si les deux champs sont vides ou invalides. */
function readDurationInput() {
  const min = $id('duration-min')?.value ?? '';
  const sec = $id('duration-sec')?.value ?? '';
  if (String(min).trim() === '' && String(sec).trim() === '') return null;
  return validDuration((Number(min) || 0) * 60 + (Number(sec) || 0));
}

function refreshDurationHint() {
  const hint = $id('duration-hint');
  const s = readDurationInput();
  if (hint) {
    hint.textContent = s === null ? '' : s < EXPRESS_S ? '🏃 Express !' : s >= MARATHON_S ? '📖 Séance marathon' : '';
  }
  refreshSaisieSanteBadge();
}

// ===================================================
//  CARNET DE SANTÉ 🩺
// ===================================================
function buildHealthChips() {
  const groupes = { symptome: $id('health-symptomes'), contexte: $id('health-contexte') };
  Object.entries(groupes).forEach(([kind, hote]) => {
    if (!hote) return;
    hote.innerHTML = HEALTH_TAGS.filter(t => t.kind === kind).map(t => `
      <button type="button" class="health-chip" data-health="${t.id}" aria-pressed="false">
        <span aria-hidden="true">${t.emoji}</span> ${t.label}
      </button>`).join('');
  });
}

function setHealthSelection(ids) {
  selectedHealth = new Set((ids || []).filter(id => healthTagMeta(id)));
  document.querySelectorAll('.health-chip').forEach(b => {
    const on = selectedHealth.has(b.dataset.health);
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  const compteur = $id('health-count');
  if (compteur) compteur.textContent = selectedHealth.size ? `${selectedHealth.size} coché${selectedHealth.size > 1 ? 's' : ''}` : '';
  // Une saisie qui a déjà du contexte s'ouvre dépliée, sinon on garde la place.
  const details = $id('health-details');
  if (details && selectedHealth.size) details.open = true;
  refreshSaisieSanteBadge();
}

// ===================================================
//  SAISIE 2 VITESSES, COULEUR FR & HYDRATATION (v3.0)
// ===================================================
const COLOR_LABELS_FR = {
  marron: 'Marron',
  jaune: 'Jaune',
  vert: 'Vert',
  noir: 'Noir',
  'arc-en-ciel': 'Arc-en-ciel',
  rouge: 'Rouge',
};

function updateSelectedColorLabel(color) {
  const el = $id('selected-color-label');
  if (!el) return;
  el.textContent = (color && COLOR_LABELS_FR[color]) || '';
}

function countSaisieSanteOptions() {
  let count = 0;
  if (selectedHealth?.size) count += selectedHealth.size;
  if (typeof readDurationInput === 'function' && readDurationInput() !== null) count += 1;
  if (($id('comment')?.value || '').trim().length > 0) count += 1;
  if (typeof selectedMood !== 'undefined' && selectedMood) count += 1;
  if ($id('mais-chk')?.checked) count += 1;
  if (typeof pendingGeo !== 'undefined' && pendingGeo) count += 1;
  return count;
}

function refreshSaisieSanteBadge() {
  const badge = $id('saisie-sante-badge');
  if (!badge) return;
  const n = countSaisieSanteOptions();
  badge.textContent = n > 0 ? String(n) : '';
  badge.classList.toggle('hidden', n === 0);
}

function switchSaisieMode(mode = 'express') {
  const target = mode === 'sante' ? 'sante' : 'express';
  $id('saisie-pane-express')?.classList.toggle('hidden', target !== 'express');
  $id('saisie-pane-sante')?.classList.toggle('hidden', target !== 'sante');
  document.querySelectorAll('.saisie-mode-btn').forEach(btn => {
    const on = btn.dataset.saisieMode === target;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', String(on));
  });
  return target;
}

function preselectSuggestedWaterTag() {
  if (typeof editingId !== 'undefined' && editingId !== null) return null;
  if (selectedHealth.has('hydratee') || selectedHealth.has('peu-eau')) return null;
  if (typeof suggestedWaterTag !== 'function' || typeof getWaterToday !== 'function') return null;
  const tag = suggestedWaterTag(getWaterToday());
  if (!tag) return null;
  const next = new Set(selectedHealth);
  next.add(tag);
  setHealthSelection([...next]);
  return tag;
}

// ===================================================
//  COMME D'HABITUDE ⚡
// ===================================================
function refreshUsualButton() {
  const btn = $id('usual-btn');
  const oneTapBtn = $id('usual-one-tap-btn');
  if (!btn && !oneTapBtn) return;
  const usual = (typeof editingId === 'undefined' || editingId === null) ? usualEntry(state.logs) : null;
  if (btn) btn.classList.toggle('hidden', !usual);
  if (oneTapBtn) oneTapBtn.classList.toggle('hidden', !usual);
  if (!usual) return;
  const place = usual.place ? window.PoopMapModule?.placeMeta(usual.place) : null;
  const desc = `${usual.texture}, ${usual.color}${place ? ', ' + place.label : ''}`;
  if (btn) btn.title = desc;
  if (oneTapBtn) oneTapBtn.title = `Enregistrer directement : ${desc}`;
}

function applyUsual() {
  const usual = usualEntry(state.logs);
  if (!usual) return;
  document.querySelector(`.texture-btn[data-texture="${usual.texture}"]`)?.click();
  document.querySelector(`.color-btn[data-color="${usual.color}"]`)?.click();
  if (usual.place) selectPlace(usual.place);
  haptic([10, 30, 10]);
  $id('save-poop')?.focus();
}

function quickSaveUsual() {
  const logs = typeof state !== 'undefined' && Array.isArray(state?.logs) ? state.logs : [];
  const usual = typeof usualEntry === 'function' ? usualEntry(logs) : null;
  if (!usual) {
    window.UI?.toast?.('Enregistre au moins 3 passages pour activer « Comme d\'hab » !', 'info');
    if ($id('drawer')?.classList.contains('hidden') && typeof openDrawer === 'function') {
      openDrawer();
    }
    return null;
  }

  const now = Date.now();
  const poop = {
    id: now + Math.random(),
    date: now,
    texture: usual.texture,
    color: usual.color,
    comment: '',
    isRetro: false,
    mood: null,
    place: usual.place || null,
    updated_at: now,
  };

  state.logs.push(poop);
  state.logs.sort((a, b) => b.date - a.date);
  if (state.logs.length > 2000) state.logs = state.logs.slice(0, 2000);
  if (typeof saveState === 'function') saveState(state);

  if (!$id('drawer')?.classList.contains('hidden') && typeof closeDrawer === 'function') {
    closeDrawer();
  }
  if (typeof renderAll === 'function') renderAll();
  haptic([15, 40, 25]);
  if (typeof announceSavedStreak === 'function') announceSavedStreak();

  if (typeof soundManager !== 'undefined') {
    soundManager.playPoopAdded(poop.texture);
  }
  if (typeof celebratePoopAdded === 'function') {
    celebratePoopAdded(typeof calculateStreak === 'function' ? calculateStreak() : 0);
  } else if (typeof showConfetti === 'function') {
    showConfetti();
  }
  if (typeof achievementManager !== 'undefined') {
    achievementManager.checkAchievements(state.logs).forEach(a => {
      achievementManager.showAchievementPopup(a);
      if (window.SupabaseClient?.isLoggedIn()) {
        window.SupabaseClient.publishBadgeEvent(a).catch(() => {});
      }
    });
  }

  if (window.SupabaseClient?.isLoggedIn()) {
    if (navigator.onLine) {
      window.SupabaseClient.savePoopCloud(poop).catch(e => {
        if (typeof $debug === 'function') $debug('cloud save err: ' + e.message);
      });
    } else if (typeof enqueueOffline === 'function') {
      enqueueOffline({ type: 'add', poop });
    }
  }

  try { localStorage.setItem('notifLastPoopTime', String(now)); } catch {}
  const placeMeta = usual.place ? window.PoopMapModule?.placeMeta?.(usual.place) : null;
  const label = `${usual.texture} · ${usual.color}${placeMeta ? ' · ' + placeMeta.emoji + ' ' + placeMeta.label : ''}`;
  window.UI?.toast?.(`⚡ Passage enregistré (${label}) !`, 'success');
  if (typeof $debug === 'function') $debug('⚡ quick-usual: ' + poop.texture + '/' + poop.color);
  return poop;
}

// ===================================================
//  RACCOURCIS D'APP (manifest shortcuts, Raccourcis iOS)
// ===================================================
/** Fonction pure : action demandée par l'URL de lancement. */
function launchAction(search) {
  const a = new URLSearchParams(search || '').get('action');
  return ['add', 'timer', 'wrapped', 'jeux', 'quick-usual'].includes(a) ? a : null;
}

function handleLaunchAction() {
  const action = launchAction(window.location.search);
  if (!action) return;
  // Retirer le paramètre : un rafraîchissement ne doit pas rouvrir la saisie.
  const params = new URLSearchParams(window.location.search);
  params.delete('action');
  const reste = params.toString();
  history.replaceState({}, '', window.location.pathname + (reste ? '?' + reste : ''));
  if (action === 'add') openDrawer();
  if (action === 'timer' && typeof startTimer === 'function') startTimer();
  if (action === 'wrapped' && typeof openYearWrapped === 'function') openYearWrapped();
  if (action === 'jeux' && typeof window.openJeux === 'function') window.openJeux();
  if (action === 'quick-usual') quickSaveUsual();
}

// ===================================================
//  CÂBLAGE
// ===================================================
function setupSaisie() {
  buildTextureArt();
  buildHealthChips();
  refreshHapticsToggle();

  document.querySelectorAll('.saisie-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => switchSaisieMode(btn.dataset.saisieMode));
  });

  $id('health-details')?.addEventListener('click', e => {
    const chip = e.target.closest('.health-chip');
    if (!chip) return;
    const id = chip.dataset.health;
    const suivant = new Set(selectedHealth);
    suivant.has(id) ? suivant.delete(id) : suivant.add(id);
    setHealthSelection([...suivant]);
    haptic(8);
  });

  ['duration-min', 'duration-sec'].forEach(id => $id(id)?.addEventListener('input', refreshDurationHint));
  $id('duration-clear')?.addEventListener('click', () => setDurationInput(null));
  $id('comment')?.addEventListener('input', refreshSaisieSanteBadge);
  $id('mais-chk')?.addEventListener('change', refreshSaisieSanteBadge);
  $id('usual-btn')?.addEventListener('click', applyUsual);
  $id('usual-one-tap-btn')?.addEventListener('click', quickSaveUsual);
  $id('dock-quick-usual')?.addEventListener('click', () => {
    $id('dock-quick-menu')?.classList.add('hidden');
    quickSaveUsual();
  });

  // Liens pour les Raccourcis iOS : copiés plutôt qu'affichés en entier
  document.querySelectorAll('[data-copy-shortcut]').forEach(b => b.addEventListener('click', async () => {
    const url = `${window.location.origin}${window.location.pathname}?action=${b.dataset.copyShortcut}`;
    try {
      await navigator.clipboard.writeText(url);
      window.UI.toast('Lien copié : colle-le dans l\'app Raccourcis', 'success');
    } catch {
      window.UI.prompt('Copie ce lien :', { title: '⚡ Raccourci', value: url, okLabel: 'Fermer' });
    }
  }));

  // Petite vibration au choix d'une texture ou d'une couleur. isTrusted : pas
  // quand le code rejoue le clic (modification, « comme d'habitude »).
  document.querySelectorAll('.texture-btn, .color-btn').forEach(b =>
    b.addEventListener('click', e => { if (e.isTrusted) haptic(8); }));
}
