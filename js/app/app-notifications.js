// ============================================================
//  app-notifications.js
//  notifications locales, rappels, resume hebdo, iCal, partage, defi streak
//  Extrait du bloc <script> de index.html. L'ordre de chargement
//  est significatif : ces fichiers partagent la portee globale.
// ============================================================

// ===================================================
//  NOTIFICATIONS
// ===================================================
function setupNotifications() {
  const toggle    = $id('notif-toggle');
  const threshold = $id('notif-threshold');
  const permBtn   = $id('notif-permission-btn');
  const statusEl  = $id('notif-status');
  if (!toggle) return;

  // Charger état sauvé
  toggle.checked       = localStorage.getItem('notifEnabled') === 'true';
  threshold.value      = localStorage.getItem('notifThreshold') || '24';

  function updatePermStatus() {
    if (!('Notification' in window)) {
      if (statusEl) statusEl.textContent = '⚠️ Notifications non supportées par ce navigateur';
      if (permBtn) permBtn.classList.add('hidden');
      return;
    }
    const p = Notification.permission;
    if (p === 'granted') {
      if (permBtn) permBtn.classList.add('hidden');
      if (statusEl) statusEl.textContent = '✅ Notifications autorisées';
    } else if (p === 'denied') {
      if (permBtn) permBtn.classList.add('hidden');
      if (statusEl) statusEl.textContent = '🚫 Notifications bloquées — à autoriser dans les réglages du navigateur';
    } else {
      if (permBtn) permBtn.classList.remove('hidden');
      if (statusEl) statusEl.textContent = 'En attente d\'autorisation';
    }
  }
  updatePermStatus();

  toggle.addEventListener('change', () => {
    localStorage.setItem('notifEnabled', toggle.checked);
  });
  threshold.addEventListener('change', () => {
    localStorage.setItem('notifThreshold', threshold.value);
  });
  permBtn?.addEventListener('click', async () => {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    updatePermStatus();
    if (result === 'granted' && toggle.checked) checkPoopNotification();
  });

  // --- Push serveur (Web Push) ---
  const pushToggle = $id('push-toggle');
  const pushStatus = $id('push-status');
  if (pushToggle) {
    if (!window.PushModule?.supported()) {
      pushToggle.disabled = true;
      if (pushStatus) pushStatus.textContent = '⚠️ Non supporté par ce navigateur';
    } else {
      window.PushModule.isEnabled().then(on => { pushToggle.checked = on; });
      pushToggle.addEventListener('change', async () => {
        pushToggle.disabled = true;
        try {
          if (pushToggle.checked) {
            await window.PushModule.enable();
            if (pushStatus) pushStatus.textContent = '✅ Push activé sur cet appareil';
          } else {
            await window.PushModule.disable();
            if (pushStatus) pushStatus.textContent = 'Push désactivé';
          }
        } catch (e) {
          pushToggle.checked = !pushToggle.checked;
          if (pushStatus) pushStatus.textContent = '❌ ' + e.message;
        } finally {
          pushToggle.disabled = false;
        }
      });
    }
  }
}

function checkPoopNotification() {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (localStorage.getItem('notifEnabled') !== 'true') return;

  const lastPoop   = parseInt(localStorage.getItem('notifLastPoopTime') || '0');
  if (!lastPoop) return; // Jamais eu de caca enregistré
  const threshold  = parseInt(localStorage.getItem('notifThreshold') || '24');
  const thresholdMs = threshold * 60 * 60 * 1000;
  // Ne pas répéter la notif plus d'une fois toutes les 4h
  const lastNotif  = parseInt(localStorage.getItem('notifLastSent') || '0');
  if (Date.now() - lastNotif < 4 * 60 * 60 * 1000) return;

  if (Date.now() - lastPoop > thresholdMs) {
    const username = window.SupabaseClient?.getCurrentProfile()?.username || '';
    const greeting = username ? `, tout va bien ${username}` : ', tout va bien';
    new Notification('💩 Caca-Tracker', {
      body: `Ça fait ${threshold}h sans caca${greeting} ? 💩`,
      icon: './favicon.svg',
      badge: './favicon.svg',
      tag: 'caca-reminder'
    });
    localStorage.setItem('notifLastSent', Date.now());
  }
}

// ===================================================
//  RAPPEL INTELLIGENT
// ===================================================
function renderSmartReminder() {
  const el = $id('smart-reminder-banner');
  if (!el) return;

  const realLogs = state.logs.filter(l => !l.isRetro);
  if (realLogs.length < 5) { el.classList.add('hidden'); return; }

  // Heure moyenne des cacas
  const avgHour = Math.round(
    realLogs.map(l => new Date(l.date).getHours()).reduce((a, b) => a + b, 0) / realLogs.length
  );

  const today = new Date().toDateString();
  const poopedToday = realLogs.some(l => new Date(l.date).toDateString() === today);
  const nowHour = new Date().getHours();

  if (!poopedToday && nowHour >= avgHour) {
    const diff = nowHour - avgHour;
    const msg = diff === 0
      ? `⏰ C'est généralement ton heure de caca (vers ${avgHour}h) !`
      : `⏰ Tu cacas généralement vers ${avgHour}h — ça fait ${diff}h que tu attends… 👀`;
    el.innerHTML = msg;
    el.classList.remove('hidden');

    // Notification intelligente (1 fois par jour)
    if ('Notification' in window && Notification.permission === 'granted' && localStorage.getItem('notifEnabled') === 'true') {
      const lastSmartNotif = parseInt(localStorage.getItem('notifSmartLastSent') || '0');
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      if (lastSmartNotif < todayStart.getTime()) {
        new Notification('⏰ Caca-Tracker', {
          body: `Tu cacas généralement vers ${avgHour}h — pas encore de caca aujourd'hui ! 💩`,
          icon: './favicon.svg',
          tag: 'smart-reminder'
        });
        localStorage.setItem('notifSmartLastSent', Date.now());
      }
    }
  } else {
    el.classList.add('hidden');
  }
}

// ===================================================
//  RÉSUMÉ DE LA SEMAINE 📊
// ===================================================
function renderWeekSummary() {
  const el      = $id('week-summary');
  const trendEl = $id('week-trend');
  if (!el) return;

  const now = new Date();
  const dow = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=Lun, 6=Dim
  const monday = new Date(now); monday.setDate(now.getDate() - dow); monday.setHours(0,0,0,0);
  const lastMonday = new Date(monday); lastMonday.setDate(monday.getDate() - 7);
  const lastSunday = new Date(monday); lastSunday.setDate(monday.getDate() - 1); lastSunday.setHours(23,59,59,999);

  const thisWeek = state.logs.filter(l => l.date >= monday.getTime());
  const lastWeek = state.logs.filter(l => l.date >= lastMonday.getTime() && l.date <= lastSunday.getTime());

  const days = {};
  thisWeek.forEach(l => { const d = new Date(l.date).toDateString(); days[d] = (days[d]||0) + 1; });
  const bestDay = Math.max(0, ...Object.values(days));

  const tw = thisWeek.length, lw = lastWeek.length;
  if (trendEl) trendEl.textContent = lw === 0 ? '' : tw > lw ? '📈' : tw < lw ? '📉' : '➡️';

  el.innerHTML = `
    <div class="rounded-[1.25rem] py-3 px-2" style="background:color-mix(in srgb,var(--accent) 10%,transparent)">
      <div class="text-2xl font-bold" style="color:var(--accent)">${tw}</div>
      <div class="text-[11px] opacity-60">Cette semaine</div>
    </div>
    <div class="rounded-[1.25rem] py-3 px-2" style="background:rgba(0,0,0,0.05)">
      <div class="text-2xl font-bold opacity-50">${lw}</div>
      <div class="text-[11px] opacity-60">Sem. dernière</div>
    </div>
    <div class="rounded-[1.25rem] py-3 px-2" style="background:rgba(0,0,0,0.05)">
      <div class="text-2xl font-bold">${bestDay}</div>
      <div class="text-[11px] opacity-60">Meilleur jour</div>
    </div>`;
}

// ===================================================
//  RAPPEL À HEURE FIXE ⏰
// ===================================================
function setupCustomReminder() {
  const timeInput = $id('custom-reminder-time');
  const enabledCb = $id('custom-reminder-enabled');
  if (!timeInput || !enabledCb) return;
  timeInput.value   = localStorage.getItem('customReminderTime') || '20:00';
  enabledCb.checked = localStorage.getItem('customReminderEnabled') === 'true';
  timeInput.addEventListener('change', () => localStorage.setItem('customReminderTime', timeInput.value));
  enabledCb.addEventListener('change', () => localStorage.setItem('customReminderEnabled', enabledCb.checked));
}

function checkCustomReminder() {
  if (localStorage.getItem('customReminderEnabled') !== 'true') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const [h, m] = (localStorage.getItem('customReminderTime') || '20:00').split(':').map(Number);
  const now = new Date();
  if (now.getHours() !== h || now.getMinutes() !== m) return;
  const lastSent = parseInt(localStorage.getItem('customReminderLastSent') || '0');
  if (Date.now() - lastSent < 60000) return;
  const today = now.toDateString();
  if (state.logs.some(l => new Date(l.date).toDateString() === today)) return;
  const label = m > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${h}h`;
  new Notification('⏰ Caca-Tracker', {
    body: `Il est ${label} et pas encore de caca aujourd'hui ! 💩`,
    icon: './favicon.svg', tag: 'custom-reminder'
  });
  localStorage.setItem('customReminderLastSent', Date.now());
}

// ===================================================
//  EXPORT iCal 📅
// ===================================================
function exportIcal() {
  if (!state.logs.length) { window.UI.toast('Aucun caca à exporter.', 'error'); return; }
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Caca-Tracker//FR','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  state.logs.forEach((log, i) => {
    const dt = new Date(log.date);
    const stamp = dt.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
    lines.push(
      'BEGIN:VEVENT',
      `UID:poop-${log.id || i}@caca-tracker`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${stamp}`,
      `DTEND:${stamp}`,
      `SUMMARY:💩 Caca (${log.texture || ''} ${log.color || ''})`.trim(),
      `DESCRIPTION:${(log.comment || '').replace(/[\n\r]/g, '\\n')}`,
      'END:VEVENT'
    );
  });
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'cacas-clemence.ics'; a.click();
  URL.revokeObjectURL(url);
}

// ===================================================
//  PARTAGER L'APPLICATION 🔗
// ===================================================
window.shareApp = async function() {
  const url      = window.location.origin + window.location.pathname;
  const feedback = $id('share-app-feedback');
  // Web Share API (iOS / Android natif)
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Caca-Tracker 3000 Deluxe 💩', text: '💩 Rejoins-moi sur Caca-Tracker !', url });
      return;
    } catch(e) { /* annulé par l'utilisateur */ }
  }
  // Fallback : copier dans le presse-papier
  try {
    await navigator.clipboard.writeText(url);
    if (feedback) {
      feedback.textContent = '✅ Lien copié ! Partage-le par SMS, WhatsApp, mail…';
      feedback.classList.remove('hidden');
      setTimeout(() => feedback.classList.add('hidden'), 4000);
    }
  } catch(e) {
    if (feedback) { feedback.textContent = url; feedback.classList.remove('hidden'); }
  }
};

// ===================================================
//  DÉFI STREAK 7 JOURS 🎯
// ===================================================
function renderStreakChallenge() {
  const streak = calculateStreak();
  const goal   = 7;
  const pct    = Math.min(100, Math.round((streak / goal) * 100));

  const bar   = $id('streak-challenge-bar');
  const label = $id('streak-challenge-label');
  const badge = $id('streak-challenge-badge');
  const msg   = $id('streak-challenge-msg');
  if (!bar) return;

  bar.style.width = pct + '%';
  label.textContent = streak + '/' + goal;

  if (streak >= goal) {
    badge.classList.remove('hidden');
    msg.textContent = '🎉 Incroyable ! Défi relevé ! Continue comme ça !';
    bar.style.background = 'linear-gradient(90deg,#f59e0b,#ef4444)';
  } else {
    badge.classList.add('hidden');
    const left = goal - streak;
    msg.textContent = left === 1
      ? '🔥 Plus qu\'un jour — tu y es presque !'
      : `💪 Encore ${left} jour${left > 1 ? 's' : ''} pour compléter le défi !`;
    bar.style.background = streak >= 4 ? 'linear-gradient(90deg,var(--accent),#f59e0b)' : 'var(--accent)';
  }
}

// Auth modal helpers
function openAuthModal(tab = 'login') {
  $id('auth-modal').classList.remove('hidden');
  switchAuthTab(tab);
}
function closeAuthModal() { $id('auth-modal').classList.add('hidden'); }
function openProfileModal() {
  if (window.SocialModule) {
    window.SocialModule.openProfileModal();
  } else {
    $id('profile-modal').classList.remove('hidden');
  }
  // Sync état du toggle mode nuit
  setTimeout(applyAutoNight, 50);
}
function closeProfileModal() { $id('profile-modal').classList.add('hidden'); }

function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  $id('form-login').classList.toggle('hidden', !isLogin);
  $id('form-signup').classList.toggle('hidden', isLogin);
  $id('auth-tab-login').style.borderColor = isLogin ? 'var(--accent)' : 'transparent';
  $id('auth-tab-login').style.color = isLogin ? 'var(--accent)' : '';
  $id('auth-tab-login').style.opacity = isLogin ? '1' : '0.6';
  $id('auth-tab-signup').style.borderColor = !isLogin ? 'var(--accent)' : 'transparent';
  $id('auth-tab-signup').style.color = !isLogin ? 'var(--accent)' : '';
  $id('auth-tab-signup').style.opacity = !isLogin ? '1' : '0.6';
}

function updateUserBadge(profile) {
  const avatar = $id('user-avatar');
  const name = $id('user-name');
  if (profile) {
    if (avatar) avatar.textContent = profile.avatar || '👤';
    if (name) name.textContent = profile.username || 'Moi';
  } else {
    if (avatar) avatar.textContent = '👤';
    if (name) name.textContent = 'Connexion';
    document.getElementById('queen-crown')?.remove();
  }
  // Lien admin visible uniquement pour les admins
  const adminLink = $id('admin-link');
  if (adminLink) adminLink.classList.toggle('hidden', !profile?.is_admin);
  // Superman icon for admins
  const heroEl = $id('admin-hero');
  if (heroEl) heroEl.classList.toggle('hidden', !profile?.is_admin);
}
window.updateUserBadge = updateUserBadge;
