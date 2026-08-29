// ============================================================
//  app-entries.js
//  ajout et suppression d'une entree
//  Extrait du bloc <script> de index.html. L'ordre de chargement
//  est significatif : ces fichiers partagent la portee globale.
// ============================================================

// ===================================================
//  ADD POOP
// ===================================================
function addPoop() {
  let valid = true;
  if (!selectedTexture) { $id('texture-err')?.classList.remove('hidden'); valid = false; }
  if (!selectedColor) { $id('color-err')?.classList.remove('hidden'); valid = false; }
  if (!valid) return;

  let timestamp = Date.now();
  const isRetro = $id('retro-chk').checked;

  if (isRetro) {
    const retroVal = $id('retro-date').value;
    if (!retroVal) { alert('Indique une date/heure !'); return; }
    const retroTs = new Date(retroVal).getTime();
    if (isNaN(retroTs)) { alert('Date invalide !'); return; }
    if (retroTs > Date.now() + 60000) { alert('La date ne peut pas être dans le futur !'); return; }
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
