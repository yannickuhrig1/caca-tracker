// ============================================================
// 👥 Social Module — groupes, podium, comparatif, feed, défis
// ============================================================

const SocialModule = (() => {

  const textureEmoji = t => ({ normal:'💩',dur:'🗿',mou:'🍮',spray:'💦',liquide:'🌊',explosif:'💥' })[t] || '💩';

  function timeAgo(ts) {
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return 'à l\'instant';
    if (s < 3600) return `il y a ${Math.floor(s/60)} min`;
    if (s < 86400) return `il y a ${Math.floor(s/3600)}h`;
    return `il y a ${Math.floor(s/86400)}j`;
  }

  // ---- Groupes sélectionné ----
  let _activeGroupId = null;
  let _feedPeriod    = 'today';
  let _feedMemberId  = '';

  // ============================================================
  //  RENDU PRINCIPAL
  // ============================================================
  async function renderSocialTab() {
    const guest     = document.getElementById('social-guest');
    const connected = document.getElementById('social-connected');
    if (!guest || !connected) return;

    if (!window.SupabaseClient?.isLoggedIn()) {
      guest.classList.remove('hidden');
      connected.classList.add('hidden');
      return;
    }

    guest.classList.add('hidden');
    connected.classList.remove('hidden');

    await renderGroupList();
  }

  // ============================================================
  //  LISTE DES GROUPES
  // ============================================================
  async function renderGroupList() {
    const listEl = document.getElementById('groups-list');
    const groupContent = document.getElementById('group-content');
    const selector = document.getElementById('group-selector');
    if (!listEl) return;

    listEl.innerHTML = '<div class="text-xs text-center opacity-60 py-2">⏳ Chargement…</div>';

    try {
      const groups = await window.SupabaseClient.getMyGroups();

      if (!groups.length) {
        listEl.innerHTML = '<div class="text-sm opacity-60 text-center py-2">Aucun groupe — crée-en un ou rejoins tes amies !</div>';
        if (groupContent) groupContent.classList.add('hidden');
        return;
      }

      listEl.innerHTML = groups.map(g => `
        <div class="flex items-center justify-between p-3 rounded-[1rem] text-sm font-bold"
             style="background:color-mix(in srgb,var(--accent) 10%,transparent)">
          <span>👥 ${esc(g.name)}</span>
          <span class="text-xs opacity-60 font-mono">${g.invite_code}</span>
        </div>`).join('');

      // Sélecteur
      if (selector) {
        selector.innerHTML = groups.map(g =>
          `<option value="${g.id}">${esc(g.name)}</option>`).join('');
        if (_activeGroupId && groups.find(g => g.id === _activeGroupId)) {
          selector.value = _activeGroupId;
        } else {
          _activeGroupId = groups[0].id;
          selector.value = _activeGroupId;
        }
      }

      if (groupContent) groupContent.classList.remove('hidden');
      await renderGroupContent(_activeGroupId);

    } catch(e) {
      listEl.innerHTML = `<div class="text-xs text-red-500 text-center">${e.message}</div>`;
    }
  }

  // ============================================================
  //  CONTENU DU GROUPE SÉLECTIONNÉ
  // ============================================================
  async function renderGroupContent(groupId) {
    if (!groupId) return;
    _activeGroupId = groupId;
    // Reset feed state when switching group
    _feedPeriod   = 'today';
    _feedMemberId = '';

    // Update share button visibility based on allow_member_invite
    const groups    = await window.SupabaseClient.getMyGroups();
    const group     = groups.find(g => g.id === groupId);
    const myProfile = window.SupabaseClient.getCurrentProfile();
    const isCreator = group?.created_by === myProfile?.id;
    const canShare  = isCreator || group?.allow_member_invite !== false;
    const shareBtn  = document.getElementById('share-group-btn');
    if (shareBtn) shareBtn.classList.toggle('hidden', !canShare);

    await Promise.all([
      renderPodium(groupId),
      renderCompareChart(groupId),
      renderFeed(groupId),
      renderChallenge(groupId),
      renderMemberFilter(groupId)
    ]);
  }

  // ============================================================
  //  FILTRE MEMBRES DU FEED
  // ============================================================
  async function renderMemberFilter(groupId) {
    const sel = document.getElementById('feed-member-filter');
    if (!sel) return;
    try {
      const members = await window.SupabaseClient.getGroupMembers(groupId);
      sel.innerHTML = '<option value="">Tous</option>' +
        members.map(m => `<option value="${m.id}">${m.avatar || '💩'} ${esc(m.username)}</option>`).join('');
      sel.value = _feedMemberId;
    } catch(e) { /* silently fail */ }
  }

  // ============================================================
  //  PODIUM 🏆
  // ============================================================
  async function renderPodium(groupId) {
    const container = document.getElementById('podium-container');
    const listEl    = document.getElementById('podium-list');
    if (!container || !listEl) return;

    container.innerHTML = '<div class="text-xs opacity-60">⏳</div>';
    listEl.innerHTML = '';

    try {
      const stats = await window.SupabaseClient.getGroupStats(groupId);
      const sorted = Object.values(stats).sort((a, b) => b.month - a.month);
      if (!sorted.length) {
        container.innerHTML = '<div class="text-xs opacity-60 text-center">Aucun membre avec des données</div>';
        return;
      }

      const medals = ['🥇','🥈','🥉'];
      const heights = ['90px','70px','55px'];
      const colors  = ['#f59e0b','#94a3b8','#b45309'];

      // Podium visuel (max 3)
      const top3 = sorted.slice(0, 3);
      const podiumOrder = top3.length >= 2 ? [top3[1], top3[0], top3[2]].filter(Boolean) : [top3[0]];
      container.innerHTML = podiumOrder.map((m, i) => {
        const rank = top3.indexOf(m);
        return `
          <div class="flex flex-col items-center gap-1 flex-1">
            <div class="text-2xl">${m.avatar}</div>
            <div class="text-xs font-bold truncate max-w-[70px] text-center">${esc(m.username)}</div>
            <div class="text-xs font-bold" style="color:${colors[rank] || '#64748b'}">${medals[rank] || ''} ${m.month}</div>
            <div class="w-full rounded-t-xl" style="height:${heights[rank] || '40px'};background:${colors[rank] || '#e2e8f0'}"></div>
          </div>`;
      }).join('');

      // Liste complète
      listEl.innerHTML = sorted.map((m, i) => `
        <div class="flex items-center gap-3 p-2 rounded-[1rem] text-sm">
          <span class="text-lg w-8 text-center">${medals[i] || String(i+1)}</span>
          <span class="text-xl">${m.avatar}</span>
          <div class="flex-1">
            <div class="font-bold">${esc(m.username)}</div>
            <div class="text-xs opacity-60">${m.streak > 0 ? '🔥' + m.streak + 'j ' : ''}${(m.month * 0.15).toFixed(1)}kg ce mois</div>
          </div>
          <span class="font-bold text-lg" style="color:var(--accent)">${m.month}</span>
        </div>`).join('');

    } catch(e) {
      container.innerHTML = `<div class="text-xs text-red-500">${e.message}</div>`;
    }
  }

  // ============================================================
  //  COMPARATIF 7 JOURS 📊
  // ============================================================
  async function renderCompareChart(groupId) {
    const el = document.getElementById('compare-chart');
    if (!el) return;
    el.innerHTML = '<div class="text-xs opacity-60 text-center">⏳</div>';

    try {
      const stats = await window.SupabaseClient.getGroupStats(groupId);
      const sorted = Object.values(stats).sort((a, b) => b.week7 - a.week7);
      const max = sorted[0]?.week7 || 1;

      el.innerHTML = sorted.map(m => {
        const pct = max > 0 ? Math.round((m.week7 / max) * 100) : 0;
        const isMe = m.username === window.SupabaseClient.getCurrentProfile()?.username;
        return `
          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm font-bold">${m.avatar} ${esc(m.username)} ${isMe ? '← toi' : ''}</span>
              <span class="text-sm font-bold" style="color:var(--accent)">${m.week7}/j${m.week7 !== 1 ? '' : ''}</span>
            </div>
            <div style="height:10px;background:rgba(0,0,0,0.08);border-radius:99px;overflow:hidden">
              <div style="width:${pct}%;height:100%;border-radius:99px;background:${isMe ? 'var(--accent)' : '#94a3b8'};transition:width .6s ease"></div>
            </div>
          </div>`;
      }).join('');

    } catch(e) {
      el.innerHTML = `<div class="text-xs text-red-500">${e.message}</div>`;
    }
  }

  // ============================================================
  //  FEED D'ACTIVITÉ 📣
  // ============================================================
  const REACTION_EMOJIS = ['💩','🔥','👑','🤣','❤️'];

  async function renderFeed(groupId, period, memberId) {
    // Update stored state
    if (period   !== undefined) _feedPeriod   = period;
    if (memberId !== undefined) _feedMemberId = memberId;

    // Update tab active styles
    document.querySelectorAll('.feed-tab-btn').forEach(btn => {
      const active = btn.dataset.period === _feedPeriod;
      btn.style.background = active
        ? 'var(--accent)'
        : 'color-mix(in srgb,var(--accent) 12%,transparent)';
      btn.style.color = active ? 'white' : 'var(--accent)';
    });

    const el = document.getElementById('activity-feed');
    if (!el) return;
    el.innerHTML = '<div class="text-xs opacity-60 text-center">⏳</div>';

    try {
      const feed = await window.SupabaseClient.getGroupFeed(groupId, 200);

      // Date cutoff for period filter
      const now    = Date.now();
      const today0 = new Date(); today0.setHours(0, 0, 0, 0);
      const cutoffs = {
        today: today0.getTime(),
        week:  now - 7 * 86400000,
        month: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(),
        year:  new Date(new Date().getFullYear(), 0, 1).getTime()
      };
      const cutoff = cutoffs[_feedPeriod] ?? cutoffs.today;

      let filtered = feed.filter(item => item.date >= cutoff);
      if (_feedMemberId) filtered = filtered.filter(item => item.user_id === _feedMemberId);

      if (!filtered.length) {
        el.innerHTML = '<div class="text-sm opacity-60 text-center py-4">Aucune activité sur cette période</div>';
        return;
      }

      el.innerHTML = filtered.map(item => {
        // Barre de réactions existantes
        const reactionBtns = REACTION_EMOJIS.map(emoji => {
          const count = item.reactions[emoji] || 0;
          const isMine = item.myReaction === emoji;
          return `<button class="reaction-btn${isMine ? ' mine' : ''}"
                    data-poop-id="${esc(item.id)}" data-emoji="${emoji}"
                    title="${isMine ? 'Retirer ma réaction' : 'Réagir'}">
                    ${emoji}${count > 0 ? ` <span>${count}</span>` : ''}
                  </button>`;
        }).join('');

        return `
          <div class="p-2 rounded-[1rem] text-sm"
               style="background:color-mix(in srgb,var(--text-secondary) 6%,transparent)">
            <div class="flex items-center gap-2">
              <span class="text-xl flex-shrink-0">${item.avatar}</span>
              <div class="flex-1 min-w-0">
                <span class="font-bold">${esc(item.username)}</span>
                <span class="opacity-70"> a fait un caca ${textureEmoji(item.texture)} ${esc(item.texture)}</span>
              </div>
              <span class="text-xs opacity-50 flex-shrink-0">${timeAgo(item.date)}</span>
            </div>
            <div class="reaction-bar">${reactionBtns}</div>
          </div>`;
      }).join('');

      // Déléguer les clics sur les boutons de réaction
      el.querySelectorAll('.reaction-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const poopId = btn.dataset.poopId;
          const emoji  = btn.dataset.emoji;
          if (!window.SupabaseClient?.isLoggedIn()) return;
          btn.disabled = true;
          try {
            await window.SupabaseClient.toggleReaction(poopId, emoji);
            await renderFeed(groupId); // Rafraîchir
          } catch(e) { console.warn('reaction err', e); btn.disabled = false; }
        });
      });

    } catch(e) {
      el.innerHTML = `<div class="text-xs text-red-500">${e.message}</div>`;
    }
  }

  // ============================================================
  //  DÉFI DE LA SEMAINE 🎯
  // ============================================================
  async function renderChallenge(groupId) {
    const titleEl     = document.getElementById('challenge-title');
    const barsEl      = document.getElementById('challenge-bars');
    const countdownEl = document.getElementById('challenge-countdown');
    if (!barsEl) return;

    barsEl.innerHTML = '<div class="text-xs opacity-60 text-center">⏳</div>';

    try {
      const challenge = await window.SupabaseClient.getOrCreateWeeklyChallenge(groupId);
      if (!challenge) { barsEl.innerHTML = '<div class="text-xs opacity-60">Aucun défi actif</div>'; return; }

      if (titleEl) titleEl.textContent = challenge.title;

      // Countdown
      if (countdownEl) {
        const end = new Date(challenge.end_date);
        end.setHours(23,59,59);
        const diffMs = end - Date.now();
        const diffH  = Math.max(0, Math.floor(diffMs / 3600000));
        const diffD  = Math.floor(diffH / 24);
        countdownEl.textContent = diffD > 0 ? `${diffD}j restants` : `${diffH}h restantes`;
      }

      const progress = await window.SupabaseClient.getChallengeProgress(groupId, challenge);
      const sorted = Object.values(progress).sort((a, b) => b.count - a.count);
      const max = sorted[0]?.count || 1;
      const me  = window.SupabaseClient.getCurrentProfile()?.username;

      barsEl.innerHTML = sorted.map((p, i) => {
        const pct  = max > 0 ? Math.round((p.count / max) * 100) : 0;
        const isMe = p.username === me;
        const medal = ['🥇','🥈','🥉'][i] || '';
        return `
          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm font-bold">${medal} ${p.avatar} ${esc(p.username)}${isMe ? ' (toi)' : ''}</span>
              <span class="text-sm font-bold" style="color:var(--accent)">${p.count} 💩</span>
            </div>
            <div style="height:10px;background:rgba(0,0,0,0.08);border-radius:99px;overflow:hidden">
              <div style="width:${pct}%;height:100%;border-radius:99px;background:${isMe ? 'var(--accent)' : '#94a3b8'};transition:width .6s ease"></div>
            </div>
          </div>`;
      }).join('');

    } catch(e) {
      barsEl.innerHTML = `<div class="text-xs text-red-500">${e.message}</div>`;
    }
  }

  // ============================================================
  //  GESTION DU GROUPE ⚙️
  // ============================================================
  async function renderMembersManagement(groupId) {
    const listEl      = document.getElementById('members-management-list');
    const deleteBtn   = document.getElementById('delete-group-btn');
    const leaveBtn    = document.getElementById('leave-group-btn');
    if (!listEl) return;

    listEl.innerHTML = '<div class="text-xs opacity-60 text-center">⏳</div>';

    try {
      const members   = await window.SupabaseClient.getGroupMembers(groupId);
      const myProfile = window.SupabaseClient.getCurrentProfile();
      const groups    = await window.SupabaseClient.getMyGroups();
      const group     = groups.find(g => g.id === groupId);
      const isCreator = group?.created_by === myProfile?.id;

      // Afficher/masquer les boutons selon le rôle
      if (deleteBtn) deleteBtn.classList.toggle('hidden', !isCreator);
      if (leaveBtn)  leaveBtn.classList.toggle('hidden', isCreator);

      // Toggle invite permission (creator only)
      const inviteToggleId = 'invite-permission-toggle';
      let inviteRow = document.getElementById('invite-permission-row');
      if (!inviteRow) {
        inviteRow = document.createElement('div');
        inviteRow.id = 'invite-permission-row';
        inviteRow.className = 'flex items-center justify-between text-sm mb-3 px-1';
        listEl.parentElement.insertBefore(inviteRow, listEl);
      }
      if (isCreator) {
        const allowed = group?.allow_member_invite !== false;
        inviteRow.innerHTML = `
          <span class="text-xs font-bold opacity-70">🔗 Membres peuvent partager le code</span>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="${inviteToggleId}" class="sr-only peer" ${allowed ? 'checked' : ''} />
            <div class="w-9 h-5 rounded-full bg-gray-300 peer-checked:bg-[var(--accent)] transition-colors duration-200"></div>
            <div class="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 peer-checked:translate-x-4"></div>
          </label>`;
        inviteRow.classList.remove('hidden');
        document.getElementById(inviteToggleId)?.addEventListener('change', async e => {
          try {
            await window.SupabaseClient.updateGroupSettings(groupId, { allow_member_invite: e.target.checked });
            await renderGroupContent(groupId);
          } catch(err) { alert('Erreur : ' + err.message); }
        });
      } else {
        inviteRow.classList.add('hidden');
      }

      listEl.innerHTML = members.map(m => {
        const isMe      = m.id === myProfile?.id;
        const canRemove = isCreator && !isMe;
        return `
          <div class="flex items-center gap-2 p-2 rounded-[1rem] text-sm"
               style="background:color-mix(in srgb,var(--accent) 5%,transparent)">
            <span class="text-lg">${m.avatar || '👤'}</span>
            <span class="flex-1 font-bold">${esc(m.username)}${isMe ? ' (toi)' : ''}${group?.created_by === m.id ? ' 👑' : ''}</span>
            ${canRemove ? `<button class="remove-member-btn text-xs text-red-400 font-bold px-2 py-1 rounded-lg"
              style="background:rgba(239,68,68,0.1)" data-user-id="${m.id}" data-username="${esc(m.username)}">
              ✕ Retirer</button>` : ''}
          </div>`;
      }).join('');

      // Clics sur les boutons "Retirer"
      listEl.querySelectorAll('.remove-member-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const username = btn.dataset.username;
          if (!confirm(`Retirer ${username} du groupe ?`)) return;
          btn.disabled = true;
          try {
            await window.SupabaseClient.removeMember(groupId, btn.dataset.userId);
            await renderMembersManagement(groupId);
            await renderGroupContent(groupId);
          } catch(e) { alert('Erreur : ' + e.message); btn.disabled = false; }
        });
      });

    } catch(e) {
      listEl.innerHTML = `<div class="text-xs text-red-500">${e.message}</div>`;
    }
  }

  // ============================================================
  //  MODAL PROFIL
  // ============================================================
  function openProfileModal() {
    const profile = window.SupabaseClient?.getCurrentProfile();
    const modal = document.getElementById('profile-modal');
    if (!modal) return;

    const loggedIn = !!profile;
    // Auth-dependent elements
    const syncBtn    = document.getElementById('sync-cloud-btn');
    const syncErr    = document.getElementById('sync-error-msg');
    const signoutBtn = document.getElementById('signout-btn');
    const loginBtn   = document.getElementById('profile-login-btn');
    const adminLink  = document.getElementById('admin-link');
    if (syncBtn)    syncBtn.classList.toggle('hidden', !loggedIn);
    if (syncErr)    syncErr.classList.add('hidden');
    if (signoutBtn) signoutBtn.classList.toggle('hidden', !loggedIn);
    if (loginBtn)   loginBtn.classList.toggle('hidden', loggedIn);
    if (adminLink)  adminLink.classList.toggle('hidden', !profile?.is_admin);

    if (profile) {
      document.getElementById('profile-avatar-display').textContent  = profile.avatar || '💩';
      document.getElementById('profile-username-display').textContent = profile.username || '';
      document.getElementById('profile-email-display').textContent    = profile.email || '';
      document.getElementById('profile-stats-display').textContent   = '☁️ Données synchronisées avec Supabase';
      // Highlight current avatar in picker
      document.querySelectorAll('.profile-avatar-opt').forEach(b => {
        b.style.outline = b.dataset.av === (profile.avatar||'💩') ? '2px solid var(--accent)' : 'none';
      });
    } else {
      document.getElementById('profile-avatar-display').textContent  = '👤';
      document.getElementById('profile-username-display').textContent = 'Invité';
      document.getElementById('profile-email-display').textContent    = 'Non connecté';
      document.getElementById('profile-stats-display').textContent   = '⚡ Thème et données locaux uniquement';
    }
    modal.classList.remove('hidden');
  }

  // ============================================================
  //  APRÈS LOGIN
  // ============================================================
  async function afterLogin() {
    const profile = window.SupabaseClient.getCurrentProfile();
    if (!profile) return;
    window.updateUserBadge?.(profile);

    // 1. Pull cloud data into local state (handles new device / fresh browser)
    await window.syncCloudData?.();

    // 2. Push any remaining local-only data to cloud
    const saved = localStorage.getItem('cacaTracker.v2');
    if (saved) {
      try {
        const st = JSON.parse(saved);
        if (st?.logs?.length) {
          await window.SupabaseClient.syncLocalToCloud(st.logs);
        }
      } catch(e) { console.warn('Sync auto échouée', e); }
    }
    // Aller sur l'onglet social
    const socialBtn = document.querySelector('[data-tab="social"]');
    if (socialBtn) socialBtn.click();
  }

  // ============================================================
  //  EVENT LISTENERS
  // ============================================================
  document.addEventListener('DOMContentLoaded', () => {

    // Créer un groupe
    document.getElementById('create-group-btn')?.addEventListener('click', async () => {
      const name = prompt('Nom du groupe (ex: Les Copines 💩)');
      if (!name?.trim()) return;
      try {
        const group = await window.SupabaseClient.createGroup(name.trim());
        alert(`Groupe créé ! Code d'invitation : ${group.invite_code}\nPartage ce code à tes amies !`);
        await renderGroupList();
      } catch(e) { alert('Erreur : ' + e.message); }
    });

    // Rejoindre un groupe
    document.getElementById('join-group-btn')?.addEventListener('click', async () => {
      const code = document.getElementById('invite-code-input')?.value.trim();
      if (!code) return;
      try {
        const group = await window.SupabaseClient.joinGroup(code);
        document.getElementById('invite-code-input').value = '';
        alert(`Tu as rejoint le groupe "${group.name}" ! 🎉`);
        await renderGroupList();
      } catch(e) { alert('Erreur : ' + e.message); }
    });

    // Changement de groupe
    document.getElementById('group-selector')?.addEventListener('change', async e => {
      _activeGroupId = e.target.value;
      document.getElementById('group-management')?.classList.add('hidden');
      await renderGroupContent(_activeGroupId);
    });

    // Ouvrir/fermer le panel de gestion
    document.getElementById('manage-group-btn')?.addEventListener('click', async () => {
      const panel = document.getElementById('group-management');
      if (panel.classList.contains('hidden')) {
        await renderMembersManagement(_activeGroupId);
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    });
    document.getElementById('close-management-btn')?.addEventListener('click', () => {
      document.getElementById('group-management')?.classList.add('hidden');
    });

    // Quitter le groupe
    document.getElementById('leave-group-btn')?.addEventListener('click', async () => {
      if (!confirm('Quitter ce groupe ?')) return;
      try {
        await window.SupabaseClient.leaveGroup(_activeGroupId);
        document.getElementById('group-management').classList.add('hidden');
        await renderGroupList();
      } catch(e) { alert('Erreur : ' + e.message); }
    });

    // Supprimer le groupe
    document.getElementById('delete-group-btn')?.addEventListener('click', async () => {
      if (!confirm('Supprimer définitivement ce groupe et toutes ses données ? Cette action est irréversible.')) return;
      try {
        await window.SupabaseClient.deleteGroup(_activeGroupId);
        document.getElementById('group-management').classList.add('hidden');
        _activeGroupId = null;
        await renderGroupList();
      } catch(e) { alert('Erreur : ' + e.message); }
    });

    // Partager le code — ouvre le QR modal
    document.getElementById('share-group-btn')?.addEventListener('click', async () => {
      const groups = await window.SupabaseClient.getMyGroups();
      const group  = groups.find(g => g.id === _activeGroupId);
      if (!group) return;
      showGroupQR(group);
    });

    // Feed period tabs (event delegation)
    document.addEventListener('click', e => {
      const tab = e.target.closest('.feed-tab-btn');
      if (!tab || !_activeGroupId) return;
      renderFeed(_activeGroupId, tab.dataset.period, _feedMemberId);
    });

    // Feed member filter
    document.getElementById('feed-member-filter')?.addEventListener('change', e => {
      if (!_activeGroupId) return;
      renderFeed(_activeGroupId, _feedPeriod, e.target.value);
    });
  });

  // ============================================================
  //  QR CODE MODAL
  // ============================================================
  function showGroupQR(group) {
    const modal = document.getElementById('qr-modal');
    if (!modal) return;

    const joinUrl = `${window.location.origin}${window.location.pathname}?join=${group.invite_code}`;
    document.getElementById('qr-group-name').textContent = `Groupe : ${group.name}`;
    document.getElementById('qr-code-text').textContent  = group.invite_code;

    const canvas = document.getElementById('qr-canvas');
    if (canvas && typeof QRCode !== 'undefined') {
      QRCode.toCanvas(canvas, joinUrl, { width: 200, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } },
        err => { if (err) console.warn('QR error', err); });
    } else if (canvas) {
      // Fallback: use free API
      const img = document.createElement('img');
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}`;
      img.style.cssText = 'width:200px;height:200px;border-radius:12px';
      canvas.replaceWith(img);
    }

    modal.classList.remove('hidden');
  }
  window.showGroupQR = showGroupQR;

  // ---- Helper XSS ----
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  return { renderSocialTab, openProfileModal, afterLogin };

})();

window.SocialModule = SocialModule;
