// ============================================================
//  app-pwa.js
//  timer de seance, service worker, pull-to-refresh
//  Extrait du bloc <script> de index.html. L'ordre de chargement
//  est significatif : ces fichiers partagent la portee globale.
// ============================================================

// ===================================================
//  TIMER DE SÉANCE ⏱️
// ===================================================
let _timerStart   = null;
let _timerInterval = null;

function setupTimer() {
  $id('timer-btn')?.addEventListener('click', () => {
    if (_timerStart) {
      stopTimer(true); // annuler
    } else {
      startTimer();
    }
  });
  $id('timer-stop-btn')?.addEventListener('click', () => stopTimer(false));
}

function startTimer() {
  _timerStart = Date.now();
  $id('timer-overlay')?.classList.remove('hidden');
  const display = $id('timer-display');
  if (display) display.classList.remove('hidden');
  _timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - _timerStart) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2,'0');
    const s = String(elapsed % 60).padStart(2,'0');
    const txt = `${m}:${s}`;
    if ($id('timer-display'))         $id('timer-display').textContent = txt;
    if ($id('timer-overlay-display')) $id('timer-overlay-display').textContent = txt;
  }, 1000);
}

function stopTimer(cancel = false) {
  if (!_timerStart) return;
  const elapsed = Math.floor((Date.now() - _timerStart) / 1000);
  clearInterval(_timerInterval);
  _timerInterval = null;
  _timerStart = null;
  $id('timer-overlay')?.classList.add('hidden');
  const display = $id('timer-display');
  if (display) { display.textContent = '00:00'; display.classList.add('hidden'); }

  if (!cancel && elapsed > 10) {
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    const durationStr = m > 0 ? `${m}min ${s}s` : `${s}s`;
    // Pré-remplir le commentaire et ouvrir le drawer
    openDrawer();
    setTimeout(() => {
      const commentEl = $id('comment');
      if (commentEl) commentEl.value = `⏱️ Durée : ${durationStr}`;
    }, 100);
  }
}

// ===================================================
//  SERVICE WORKER
// ===================================================
function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  // updateViaCache:'none' → le navigateur ne met JAMAIS sw.js en cache HTTP
  // → il détecte toujours les nouvelles versions du SW
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(reg => {
    $debug('SW registered');

    // Vérifier une mise à jour immédiatement au chargement
    reg.update();

    // Si un nouveau SW attend déjà (rechargement après update)
    if (reg.waiting) showUpdateBanner(reg.waiting);

    // Nouveau SW trouvé → attendre qu'il soit installé
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // Nouveau SW installé et en attente → montrer la bannière
          showUpdateBanner(newWorker);
        }
      });
    });
  }).catch(e => $debug('SW err: ' + e.message));

  // Quand le SW actif change (après SKIP_WAITING) → recharger la page
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}

function showUpdateBanner(worker) {
  const banner = $id('update-banner');
  if (!banner) return;
  banner.classList.remove('hidden');
  banner.addEventListener('click', () => {
    banner.textContent = '⏳ Mise à jour en cours…';
    worker.postMessage('SKIP_WAITING');
  }, { once: true });
}

function showInstallBanner() {
  // iOS standalone check
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.navigator.standalone === true;
  const dismissed = LS_OK && localStorage.getItem('install-dismissed');
  if (isIos && !isStandalone && !dismissed) {
    setTimeout(() => $id('install-banner')?.classList.remove('hidden'), 2000);
  }
}

// ===================================================
//  PULL-TO-REFRESH  (feature 2)
// ===================================================
function setupPullToRefresh() {
  const main = document.querySelector('main');
  if (!main || !('ontouchstart' in window)) return;

  // Create indicator (injected into body, fixed at top)
  const indicator = document.createElement('div');
  indicator.id = 'ptr-indicator';
  indicator.className = 'hidden';
  indicator.textContent = '⬇️ Tire pour actualiser';
  document.body.appendChild(indicator);

  let startY = 0;
  let pulling = false;
  const THRESHOLD = 72;

  document.addEventListener('touchstart', e => {
    // Trigger only on social tab when scrolled to top
    const socialTab = $id('social-tab');
    if (!socialTab?.classList.contains('active')) return;
    if (window.scrollY > 5) return;
    startY = e.touches[0].clientY;
    pulling = true;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 20) {
      indicator.classList.remove('hidden');
      indicator.textContent = dy > THRESHOLD ? '🔄 Relâche pour actualiser' : '⬇️ Tire vers le bas';
      indicator.style.transform = `translateY(${Math.min(dy - 20, 40)}px)`;
    }
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!pulling) return;
    const dy = e.changedTouches[0].clientY - startY;
    if (dy > THRESHOLD) {
      indicator.textContent = '⏳ Actualisation…';
      window.SocialModule?.renderSocialTab().then(() => {
        indicator.classList.add('hidden');
        indicator.style.transform = '';
      });
    } else {
      indicator.classList.add('hidden');
      indicator.style.transform = '';
    }
    pulling = false;
  }, { passive: true });
}
