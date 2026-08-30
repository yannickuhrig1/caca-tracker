// ============================================================
//  app-entries.js
//  ajout et suppression d'une entree
//  Extrait du bloc <script> de index.html. L'ordre de chargement
//  est significatif : ces fichiers partagent la portee globale.
// ============================================================

// ===================================================
//  ADD POOP
// ===================================================
// id de l'entrée en cours de modification, null en création
let editingId = null;

function addPoop() {
  if (editingId !== null) return saveEditedPoop();

  let valid = true;
  if (!selectedTexture) { $id('texture-err')?.classList.remove('hidden'); valid = false; }
  if (!selectedColor) { $id('color-err')?.classList.remove('hidden'); valid = false; }
  if (!valid) return;

  let timestamp = Date.now();
  const isRetro = $id('retro-chk').checked;

  if (isRetro) {
    const retroVal = $id('retro-date').value;
    if (!retroVal) { window.UI.toast('Indique une date/heure !', 'error'); return; }
    const retroTs = new Date(retroVal).getTime();
    if (isNaN(retroTs)) { window.UI.toast('Date invalide !', 'error'); return; }
    if (retroTs > Date.now() + 60000) { window.UI.toast('La date ne peut pas être dans le futur !', 'error'); return; }
    timestamp = retroTs;
  }

  const poop = {
    id: Date.now() + Math.random(),
    date: timestamp,
    texture: selectedTexture,
    color: selectedColor,
    comment: $id('comment').value.trim(),
    isRetro: isRetro,
    mood: selectedMood || null,
    updated_at: Date.now()
  };

  state.logs.push(poop);
  state.logs.sort((a, b) => b.date - a.date);
  if (state.logs.length > 2000) state.logs = state.logs.slice(0, 2000);
  saveState(state);

  closeDrawer();
  renderAll();

  // Son selon la texture
  if (!isRetro && typeof soundManager !== 'undefined') {
    soundManager.playPoopAdded(poop.texture);
  }

  // Modules v2.0
  if (!isRetro) {
    if (typeof celebratePoopAdded === 'function') {
      celebratePoopAdded(calculateStreak());
    } else {
      showConfetti();
    }
  }
  if (typeof achievementManager !== 'undefined') {
    achievementManager.checkAchievements(state.logs).forEach(a => {
      achievementManager.showAchievementPopup(a);
      // Publier le déblocage dans le feed du groupe (feature #3)
      if (window.SupabaseClient?.isLoggedIn()) {
        window.SupabaseClient.publishBadgeEvent(a).catch(() => {});
      }
    });
  }

  // Sync cloud si connecté
  if (window.SupabaseClient?.isLoggedIn()) {
    if (navigator.onLine) {
      window.SupabaseClient.savePoopCloud(poop).catch(e => $debug('cloud save err: ' + e.message));
    } else {
      // Hors ligne → mettre en queue
      try {
        const queue = JSON.parse(localStorage.getItem('cacaTracker.offlineQueue') || '[]');
        queue.push({ type: 'add', poop });
        localStorage.setItem('cacaTracker.offlineQueue', JSON.stringify(queue));
        $debug('📥 Hors ligne — caca mis en queue (sync au retour)');
      } catch(e) { $debug('queue err: ' + e.message); }
    }
  }

  // Notifications : mettre à jour l'heure du dernier caca
  if (!isRetro) localStorage.setItem('notifLastPoopTime', Date.now());

  $debug('➕ ' + poop.texture + '/' + poop.color + (isRetro ? ' [rétro ' + new Date(timestamp).toLocaleString('fr') + ']' : ''));
}

// ===================================================
//  EDIT POOP
// ===================================================
// Ouvre le drawer pré-rempli sur une entrée existante.
// Le drawer est le même qu'en création : seuls le titre, le libellé du
// bouton et le comportement de `addPoop` changent (cf. editingId).
window.editLog = function(idOrIndex) {
  const log = findLog(idOrIndex);
  if (!log) return;

  editingId = log.id;
  openDrawer();

  $id('drawer-title').textContent    = 'Modifier 💩';
  $id('drawer-subtitle').textContent = 'Corrige ce qui ne va pas';
  $id('save-poop').innerHTML         = '💾 Enregistrer';

  // Texture / couleur : on rejoue le clic pour réutiliser le rendu de sélection
  document.querySelector(`.texture-btn[data-texture="${log.texture}"]`)?.click();
  document.querySelector(`.color-btn[data-color="${log.color}"]`)?.click();
  if (log.mood) document.querySelector(`.mood-btn[data-mood="${log.mood}"]`)?.click();

  $id('comment').value = log.comment || '';

  // En édition la date est toujours modifiable : on masque le toggle
  // « caca en retard » (qui décrit une saisie, pas une correction) et on
  // ouvre directement le champ, pré-rempli en heure locale.
  $id('retro-toggle-row').classList.add('hidden');
  $id('retro-date-label').textContent = 'Date et heure :';
  $id('retro-chk').checked = true;
  $id('retro-date-wrap').classList.remove('hidden');
  refreshRetroMax();
  $id('retro-date').value = toLocalDatetimeValue(log.date);
};

// <input type="datetime-local"> attend AAAA-MM-JJTHH:MM en heure LOCALE.
// toISOString() renverrait de l'UTC et décalerait l'heure affichée.
function toLocalDatetimeValue(ts) {
  const d = new Date(ts);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function findLog(idOrIndex) {
  const byId = state.logs.find(l => String(l.id) === String(idOrIndex));
  if (byId) return byId;
  const i = Number(idOrIndex);
  return Number.isInteger(i) ? state.logs[i] : null;
}

function saveEditedPoop() {
  const log = findLog(editingId);
  if (!log) { editingId = null; closeDrawer(); return; }

  let valid = true;
  if (!selectedTexture) { $id('texture-err')?.classList.remove('hidden'); valid = false; }
  if (!selectedColor)   { $id('color-err')?.classList.remove('hidden');   valid = false; }
  if (!valid) return;

  const dateVal = $id('retro-date').value;
  if (!dateVal) { window.UI.toast('Indique une date/heure !', 'error'); return; }
  const ts = new Date(dateVal).getTime();
  if (isNaN(ts)) { window.UI.toast('Date invalide !', 'error'); return; }
  if (ts > Date.now() + 60000) { window.UI.toast('La date ne peut pas être dans le futur !', 'error'); return; }

  log.date     = ts;
  log.texture  = selectedTexture;
  log.color    = selectedColor;
  log.comment  = $id('comment').value.trim();
  log.mood     = selectedMood || null;
  // isRetro décrit la saisie d'origine, pas la modification : on n'y touche pas.
  log.updated_at = Date.now();   // arbitre la résolution de conflit multi-appareils

  state.logs.sort((a, b) => b.date - a.date);
  saveState(state);

  closeDrawer();
  renderAll();
  window.UI.toast('Caca modifié', 'success');

  // savePoopCloud fait un upsert sur (user_id, local_id) : le même id met à jour
  // la ligne existante au lieu d'en créer une nouvelle.
  if (window.SupabaseClient?.isLoggedIn()) {
    if (navigator.onLine) {
      window.SupabaseClient.savePoopCloud(log).catch(e => $debug('cloud edit err: ' + e.message));
    } else {
      try {
        const queue = JSON.parse(localStorage.getItem('cacaTracker.offlineQueue') || '[]');
        queue.push({ type: 'add', poop: log });   // 'add' = upsert, donc vaut aussi pour une édition
        localStorage.setItem('cacaTracker.offlineQueue', JSON.stringify(queue));
        $debug('📥 Hors ligne — modification mise en queue');
      } catch (e) { $debug('queue edit err: ' + e.message); }
    }
  }

  $debug('✏️ ' + log.texture + '/' + log.color);
}
