// ============================================================
//  app-events.js
//  cablage de tous les ecouteurs d'evenements
//  Extrait du bloc <script> de index.html. L'ordre de chargement
//  est significatif : ces fichiers partagent la portee globale.
// ============================================================

// ===================================================
//  EVENTS
// ===================================================
function setupEvents() {
  $id('poop-btn').addEventListener('click', openDrawer);
  $id('cancel-drawer').addEventListener('click', closeDrawer);
  $id('save-poop').addEventListener('click', addPoop);
  $id('export-btn').addEventListener('click', exportData);
  $id('export-pdf-btn')?.addEventListener('click', exportMedicalPDF);

  // Pull-to-refresh sur le social tab (feature 2)
  setupPullToRefresh();

  // Offline → online : vider la queue
  window.addEventListener('online', () => {
    $debug('🌐 Connexion rétablie — traitement de la queue offline…');
    processOfflineQueue();
  });
  $id('import-input').addEventListener('change', importData);
  $id('clear-btn').addEventListener('click', clearAll);

  // Close drawer on backdrop click
  $id('drawer-outer').addEventListener('click', e => {
    if (e.target === $id('drawer-outer')) closeDrawer();
  });

  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Texture buttons
  document.querySelectorAll('.texture-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedTexture = btn.dataset.texture;
      document.querySelectorAll('.texture-btn').forEach(b => b.classList.remove('border-amber-500', 'bg-amber-100', 'selected'));
      btn.classList.add('border-amber-500', 'bg-amber-100', 'selected');
      $id('texture-err')?.classList.add('hidden');
    });
  });

  // Color buttons
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedColor = btn.dataset.color;
      document.querySelectorAll('.color-btn').forEach(b => b.style.transform = '');
      btn.style.transform = 'scale(1.25)';
      btn.style.outline = '3px solid var(--accent)';
      document.querySelectorAll('.color-btn').forEach(b => { if (b !== btn) b.style.outline = ''; });
      $id('color-err')?.classList.add('hidden');
    });
  });

  // Retro toggle
  $id('retro-chk').addEventListener('change', e => {
    $id('retro-date-wrap').classList.toggle('hidden', !e.target.checked);
    if (e.target.checked) refreshRetroMax();
  });

  // Theme dots (delegation — works for dynamically-added profile grid buttons too)
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-theme-btn]');
    if (!btn) return;
    const t = btn.dataset.themeBtn;
    applyTheme(t);
    state.theme = t;
    saveState(state);
  });

  // Install banner dismiss
  $id('dismiss-banner')?.addEventListener('click', () => {
    $id('install-banner').classList.add('hidden');
    if (LS_OK) localStorage.setItem('install-dismissed', '1');
  });

  // Swipe horizontal entre onglets (mobile)
  const _tabOrder = ['dashboard','stats','badges','admin','social'];
  let _swipeStartX = 0;
  document.querySelector('main')?.addEventListener('touchstart', e => {
    _swipeStartX = e.touches[0].clientX;
  }, { passive: true });
  document.querySelector('main')?.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - _swipeStartX;
    if (Math.abs(dx) < 120) return;
    // Ne pas swiper si le drawer est ouvert
    if (!$id('drawer')?.classList.contains('hidden')) return;
    const current = document.querySelector('.tab-content.active')?.id?.replace('-tab','');
    const idx = _tabOrder.indexOf(current);
    if (dx < -120 && idx < _tabOrder.length - 1) switchTab(_tabOrder[idx + 1]);
    if (dx >  120 && idx > 0)                    switchTab(_tabOrder[idx - 1]);
  }, { passive: true });

  // Blague aléatoire
  $id('random-joke-btn')?.addEventListener('click', () => window.JokesModule?.showRandomJoke());

  // User badge → toujours ouvrir le profil modal (thème + avatar + login si besoin)
  $id('user-badge')?.addEventListener('click', () => openProfileModal());

  // Social tab login button
  $id('social-login-btn')?.addEventListener('click', () => openAuthModal('login'));

  // Auth modal tabs
  $id('auth-tab-login')?.addEventListener('click', () => switchAuthTab('login'));
  $id('auth-tab-signup')?.addEventListener('click', () => switchAuthTab('signup'));

  // Auth guest
  $id('auth-guest-btn')?.addEventListener('click', closeAuthModal);

  // Auth submit (login)
  $id('auth-submit')?.addEventListener('click', async () => {
    const email = $id('auth-email').value.trim();
    const pass = $id('auth-password').value;
    if (!email || !pass) return;
    $id('auth-submit').textContent = '⏳ Connexion…';
    $id('auth-submit').disabled = true;
    try {
      await window.SupabaseClient.signIn(email, pass);
      closeAuthModal();
      await window.SocialModule?.afterLogin();
    } catch(e) {
      const err = $id('auth-error');
      err.textContent = e.message || 'Erreur de connexion';
      err.classList.remove('hidden');
    } finally {
      $id('auth-submit').textContent = 'Se connecter';
      $id('auth-submit').disabled = false;
    }
  });

  // Forgot password
  $id('forgot-password-btn')?.addEventListener('click', async () => {
    const email = $id('auth-email').value.trim();
    if (!email) { alert('Entre ton adresse email d\'abord.'); return; }
    const btn = $id('forgot-password-btn');
    btn.textContent = '⏳ Envoi…';
    btn.disabled = true;
    try {
      await window.SupabaseClient.resetPassword(email);
      alert('📧 Email envoyé ! Vérifie ta boîte mail pour réinitialiser ton mot de passe.');
      closeAuthModal();
    } catch(e) {
      alert('Erreur : ' + e.message);
    } finally {
      btn.textContent = 'Mot de passe oublié ?';
      btn.disabled = false;
    }
  });

  // Nouveau mot de passe (retour du lien de reset)
  $id('new-password-submit')?.addEventListener('click', async () => {
    const pwd     = $id('new-password-input').value;
    const confirm = $id('new-password-confirm').value;
    const errEl   = $id('new-password-error');
    errEl.classList.add('hidden');
    if (pwd.length < 6) {
      errEl.textContent = 'Mot de passe trop court (min. 6 caractères)';
      errEl.classList.remove('hidden'); return;
    }
    if (pwd !== confirm) {
      errEl.textContent = 'Les mots de passe ne correspondent pas';
      errEl.classList.remove('hidden'); return;
    }
    const btn = $id('new-password-submit');
    btn.textContent = '⏳ Enregistrement…'; btn.disabled = true;
    try {
      await window.SupabaseClient.updatePassword(pwd);
      $id('new-password-modal').classList.add('hidden');
      alert('✅ Mot de passe modifié avec succès !');
    } catch(e) {
      errEl.textContent = 'Erreur : ' + e.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.textContent = 'Enregistrer le mot de passe'; btn.disabled = false;
    }
  });

  // Signup submit
  $id('signup-submit')?.addEventListener('click', async () => {
    const username = $id('signup-username').value.trim();
    const email = $id('signup-email').value.trim();
    const pass = $id('signup-password').value;
    const avatar = document.querySelector('.avatar-opt.selected')?.dataset.avatar || '💩';
    if (!username || !email || !pass) return;
    $id('signup-submit').textContent = '⏳ Création…';
    $id('signup-submit').disabled = true;
    try {
      await window.SupabaseClient.signUp(email, pass, username, avatar);
      closeAuthModal();
      await window.SocialModule?.afterLogin();
    } catch(e) {
      const err = $id('signup-error');
      err.textContent = e.message || 'Erreur à la création du compte';
      err.classList.remove('hidden');
    } finally {
      $id('signup-submit').textContent = 'Créer mon compte';
      $id('signup-submit').disabled = false;
    }
  });

  // Mood picker
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mood = btn.dataset.mood;
      if (selectedMood === mood) {
        // Désélectionner si on reclique
        selectedMood = null;
        document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('border-amber-400','bg-amber-50'));
      } else {
        selectedMood = mood;
        document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('border-amber-400','bg-amber-50'));
        btn.classList.add('border-amber-400','bg-amber-50');
      }
    });
  });

  // Avatar picker
  document.querySelectorAll('.avatar-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.avatar-opt').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  // Profile modal
  $id('close-profile-modal')?.addEventListener('click', closeProfileModal);
  $id('signout-btn')?.addEventListener('click', async () => {
    await window.SupabaseClient?.signOut();
    updateUserBadge(null);
    closeProfileModal();
    renderAll();
    $debug('🚪 signed out');
  });
  $id('profile-login-btn')?.addEventListener('click', () => {
    closeProfileModal();
    openAuthModal('login');
  });
  $id('sync-cloud-btn')?.addEventListener('click', async () => {
    const btn = $id('sync-cloud-btn');
    const errDiv = $id('sync-error-msg');
    btn.textContent = '⏳ Synchronisation…';
    if (errDiv) errDiv.classList.add('hidden');
    try {
      await window.SupabaseClient.syncLocalToCloud(state.logs);
      btn.textContent = '✅ Synchronisé !';
      setTimeout(() => { btn.textContent = '☁️ Synchroniser mes données'; }, 3000);
    } catch(e) {
      btn.textContent = '❌ Erreur sync';
      if (errDiv) { errDiv.textContent = e.message || 'Erreur inconnue'; errDiv.classList.remove('hidden'); }
      setTimeout(() => { btn.textContent = '☁️ Synchroniser mes données'; if (errDiv) errDiv.classList.add('hidden'); }, 6000);
    }
  });

  // ── QR Modal ─────────────────────────────────────────────
  $id('close-qr-modal')?.addEventListener('click', () => $id('qr-modal').classList.add('hidden'));

  // Onboarding
  $id('onboarding-next')?.addEventListener('click', nextOnboardingSlide);
  $id('onboarding-skip')?.addEventListener('click', closeOnboarding);
  $id('replay-onboarding-btn')?.addEventListener('click', () => window.replayOnboarding());

  // Quoi de neuf
  $id('whatsnew-close')?.addEventListener('click', closeWhatsNew);
  $id('replay-whatsnew-btn')?.addEventListener('click', () => window.replayWhatsNew());
  $id('qr-modal')?.addEventListener('click', e => { if (e.target === $id('qr-modal')) $id('qr-modal').classList.add('hidden'); });

  // ── Avatar picker (profile modal) ────────────────────────
  const AVATARS = ['💩','🐻','🦊','🐼','🐱','🐶','🐸','🐷','🐮','🦁','🐯','🐻‍❄️','🦄','🐙','🦋','🌸','🌙','⭐','🌈','🎀','👑','🍦','🎸','🧁','🌺','🦩','🐢','🦀','🧸','🎭'];
  const avatarGrid = $id('avatar-picker-grid');
  if (avatarGrid) {
    avatarGrid.innerHTML = AVATARS.map(a => `
      <button class="profile-avatar-opt w-10 h-10 rounded-[0.75rem] flex items-center justify-center text-xl hover:scale-110 transition-transform"
        data-av="${a}" style="background:color-mix(in srgb,var(--accent) 8%,transparent)">${a}</button>`
    ).join('');
    avatarGrid.querySelectorAll('.profile-avatar-opt').forEach(btn => {
      btn.addEventListener('click', async () => {
        const av = btn.dataset.av;
        avatarGrid.querySelectorAll('.profile-avatar-opt').forEach(b =>
          b.style.outline = b.dataset.av === av ? '2px solid var(--accent)' : 'none');
        $id('profile-avatar-display').textContent = av;
        $id('user-avatar').textContent = av;
        if (window.SupabaseClient?.isLoggedIn()) {
          try { await window.SupabaseClient.updateProfile({ avatar: av }); } catch(e) {}
        }
      });
    });
  }

  // ── Theme picker (profile modal) ─────────────────────────
  const ALL_THEMES = [
    { id:'default',   label:'Chaud 🟠',       grad:'linear-gradient(135deg,#d97706,#ea580c)' },
    { id:'dark',      label:'Dark 🌙',         grad:'linear-gradient(135deg,#1e1b4b,#312e81)' },
    { id:'medical',   label:'Médical 🩺',      grad:'linear-gradient(135deg,#059669,#0284c7)' },
    { id:'kawaii',    label:'Kawaii 🌸',        grad:'linear-gradient(135deg,#e91e8c,#9c27b0)' },
    { id:'foret',     label:'Forêt 🌿',         grad:'linear-gradient(135deg,#2e7d32,#558b2f)' },
    { id:'ocean',     label:'Océan 🌊',         grad:'linear-gradient(135deg,#0277bd,#00838f)' },
    { id:'sunset',    label:'Sunset 🌅',        grad:'linear-gradient(135deg,#ff6b6b,#c77dff)' },
    { id:'galaxy',    label:'Galaxy 🌌',        grad:'linear-gradient(135deg,#6a0572,#3a0ca3)' },
    { id:'sakura',    label:'Sakura 🌸',        grad:'linear-gradient(135deg,#e91e8c,#ff6b9d)' },
    { id:'mint',      label:'Mint 🌿',          grad:'linear-gradient(135deg,#00b894,#00cec9)' },
    { id:'lavande',   label:'Lavande 💜',       grad:'linear-gradient(135deg,#7c3aed,#9d4edd)' },
    { id:'rose-gold', label:'Rose Gold 🌹',     grad:'linear-gradient(135deg,#c97b6a,#e0a87c)' },
    { id:'tropicale', label:'Tropicale 🌴',     grad:'linear-gradient(135deg,#00b8a9,#0097a7)' },
    { id:'nordique',  label:'Nordique ❄️',      grad:'linear-gradient(135deg,#2c5f8a,#3a7bd5)' },
    { id:'automne',   label:'Automne 🍂',       grad:'linear-gradient(135deg,#b45309,#c2410c)' },
    { id:'neon',      label:'Neon ⚡',           grad:'linear-gradient(135deg,#00ff88,#00e5cc)' },
  ];
  const themeGrid = $id('profile-theme-grid');
  if (themeGrid) {
    themeGrid.innerHTML = ALL_THEMES.map(t => `
      <button class="profile-theme-btn rounded-[0.75rem] p-2 text-xs font-bold text-white text-center leading-tight hover:scale-105 transition-transform"
        data-theme-btn="${t.id}" style="background:${t.grad};min-height:52px;box-shadow:0 2px 8px #0002"
        title="${t.label}">${t.label}</button>`
    ).join('');
  }

  // Notifications settings
  setupNotifications();
}
