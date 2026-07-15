// ============================================================
// 👥 Social Module — groupes, podium, comparatif, feed, défis
// ============================================================

const SocialModule = (() => {

  const textureEmoji = t => ({ normal:'💩',dur:'🗿',mou:'🍮',spray:'💦',liquide:'🌊',explosif:'💥' })[t] || '💩';

  // --- Skeleton helpers (feature 6) ---
  function skeletonBars(n = 3) {
    return Array.from({ length: n }, () => `
      <div class="flex items-center gap-2 mb-3">
        <div class="skeleton skeleton-circle"></div>
        <div class="flex-1">
          <div class="skeleton skeleton-line skeleton-med"></div>
          <div class="skeleton skeleton-line skeleton-full" style="height:8px"></div>
        </div>
        <div class="skeleton skeleton-line" style="width:28px;height:20px"></div>
      </div>`).join('');
  }
  function skeletonFeed(n = 4) {
    return Array.from({ length: n }, () => `
      <div class="p-2 rounded-[1rem]" style="background:color-mix(in srgb,var(--accent) 4%,transparent)">
        <div class="flex items-center gap-2 mb-2">
          <div class="skeleton skeleton-circle" style="width:32px;height:32px"></div>
          <div class="flex-1">
            <div class="skeleton skeleton-line skeleton-med"></div>
          </div>
          <div class="skeleton skeleton-line" style="width:36px;height:10px"></div>
        </div>
        <div class="flex gap-1 mt-1">
          ${Array.from({length:5},()=>'<div class="skeleton" style="width:30px;height:22px;border-radius:99px"></div>').join('')}
        </div>
      </div>`).join('');
  }

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

    initRealtime();
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

    listEl.innerHTML = skeletonBars(2);

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
      renderWeeklyRecap(groupId),
      renderPodium(groupId),
      renderCompareChart(groupId),
      renderFeed(groupId),
      renderChallenge(groupId),
      renderMemberFilter(groupId),
      renderMonthlyHistory(groupId),
      renderHallOfFame(groupId)
    ]);
    updateQueenCrown();
    checkWinnerCelebration(groupId);
  }

  // ============================================================
  //  PODIUMS DES MOIS PASSÉS (v2.10.0)
  // ============================================================
  async function renderMonthlyHistory(groupId) {
    const el = document.getElementById('monthly-history');
    if (!el) return;
    el.innerHTML = skeletonBars(2);
    try {
      const months = await window.SupabaseClient.getGroupMonthlyRanking(groupId, 3);
      const medals = ['🥇', '🥈', '🥉'];
      const withData = months.filter(m => m.ranking.length);
      if (!withData.length) {
        el.innerHTML = '<p class="text-sm opacity-60 text-center">Pas encore de mois complet dans ce groupe 📆</p>';
        return;
      }
      el.innerHTML = withData.map(m => `
        <div class="flex items-start justify-between gap-3 py-2 border-b last:border-b-0" style="border-color:rgba(0,0,0,0.07)">
          <div class="font-semibold text-sm capitalize whitespace-nowrap">${m.label}</div>
          <div class="text-sm text-right space-y-0.5">
            ${m.ranking.map((r, i) => `<div>${medals[i]} ${r.avatar} <span class="font-medium">${r.username}</span> <span class="opacity-60">— ${r.count}</span></div>`).join('')}
          </div>
        </div>`).join('');
    } catch (e) {
      el.innerHTML = '<p class="text-sm opacity-60 text-center">Erreur de chargement 😕</p>';
    }
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

    container.innerHTML = skeletonBars(3);
    listEl.innerHTML = '';

    try {
      const stats = await window.SupabaseClient.getGroupStats(groupId);
      const trophies = await window.SupabaseClient.getGroupTrophies(groupId).catch(() => ({}));
      const myId = window.SupabaseClient.getCurrentProfile()?.id;
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

      // Liste complète (avec trophées #5 + nudge #2)
      listEl.innerHTML = sorted.map((m, i) => {
        const tro = trophies[m.id] || 0;
        const canNudge = m.id !== myId && (m.today || 0) === 0;
        return `
        <div class="flex items-center gap-3 p-2 rounded-[1rem] text-sm">
          <span class="text-lg w-8 text-center">${medals[i] || String(i+1)}</span>
          <span class="text-xl">${m.avatar}</span>
          <div class="flex-1 min-w-0">
            <div class="font-bold flex items-center gap-1">${esc(m.username)}${tro > 0 ? ` <span class="trophy-count">🏆${tro}</span>` : ''}</div>
            <div class="text-xs opacity-60">${m.streak > 0 ? '🔥' + m.streak + 'j ' : ''}${(m.month * 0.15).toFixed(1)}kg ce mois</div>
          </div>
          ${canNudge ? `<button class="nudge-btn" data-nudge="${m.id}" data-username="${esc(m.username)}">👉 Relancer</button>` : ''}
          <span class="font-bold text-lg" style="color:var(--accent)">${m.month}</span>
        </div>`;
      }).join('');

      listEl.querySelectorAll('[data-nudge]').forEach(btn =>
        btn.addEventListener('click', () => onNudge(btn, groupId)));

    } catch(e) {
      container.innerHTML = `<div class="text-xs text-red-500">${esc(e.message)}</div>`;
    }
  }

  // ============================================================
  //  COMPARATIF 7 JOURS 📊
  // ============================================================
  async function renderCompareChart(groupId) {
    const el = document.getElementById('compare-chart');
    if (!el) return;
    el.innerHTML = skeletonBars(3);

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
  // Jeu de réactions élargi (feature #8)
  const REACTION_EMOJIS = ['💩','🔥','👑','🤣','❤️','😱','🤢','⚡'];
  let _feedItems = [];               // cache local pour les mises à jour optimistes
  const _openComments = new Set();   // poopIds dont le fil de commentaires est ouvert

  function reactionBtnHTML(item, emoji) {
    const count = item.reactions[emoji] || 0;
    const isMine = item.myReaction === emoji;
    return `<button class="reaction-btn${isMine ? ' mine' : ''}" data-poop-id="${esc(item.id)}" data-emoji="${emoji}" title="${isMine ? 'Retirer ma réaction' : 'Réagir'}">${emoji}${count > 0 ? ` <span>${count}</span>` : ''}</button>`;
  }

  function renderBadgeItem(item) {
    return `
      <div class="feed-badge">
        <span class="fb-emoji">${item.emoji || '🏅'}</span>
        <div class="flex-1 min-w-0">
          <span class="font-bold">${esc(item.username)}</span>
          <span class="opacity-80"> a débloqué </span><span class="font-bold">${esc(item.title || 'un badge')}</span> 🎉
        </div>
        <span class="text-xs opacity-50 flex-shrink-0">${timeAgo(item.date)}</span>
      </div>`;
  }

  function renderPoopItem(item) {
    const reactionBtns = REACTION_EMOJIS.map(e => reactionBtnHTML(item, e)).join('');
    const open = _openComments.has(item.id);
    const cLabel = item.commentCount > 0 ? `💬 ${item.commentCount}` : '💬 Commenter';
    return `
      <div class="p-2 rounded-[1rem] text-sm" data-feed-poop="${esc(item.id)}"
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
        <div class="feed-actions">
          <button class="comment-toggle" data-comment-toggle="${esc(item.id)}">${cLabel}</button>
        </div>
        <div class="comment-thread" data-comment-thread="${esc(item.id)}" ${open ? '' : 'style="display:none"'}></div>
      </div>`;
  }

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
    el.innerHTML = skeletonFeed(4);

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
      _feedItems = filtered;

      if (!filtered.length) {
        el.innerHTML = '<div class="text-sm opacity-60 text-center py-4">Aucune activité sur cette période</div>';
        return;
      }

      el.innerHTML = filtered.map(item =>
        item.kind === 'badge' ? renderBadgeItem(item) : renderPoopItem(item)
      ).join('');

      // Clics réactions (mise à jour optimiste — feature #9)
      el.querySelectorAll('.reaction-btn').forEach(btn =>
        btn.addEventListener('click', () => onReactionClick(btn, groupId)));
      // Toggle commentaires (feature #1)
      el.querySelectorAll('[data-comment-toggle]').forEach(btn =>
        btn.addEventListener('click', () => toggleComments(btn.dataset.commentToggle, groupId)));

      // Recharger les fils de commentaires restés ouverts
      _openComments.forEach(pid => {
        if (filtered.some(i => i.id === pid)) loadComments(pid, groupId);
      });

    } catch(e) {
      el.innerHTML = `<div class="text-xs text-red-500">${esc(e.message)}</div>`;
    }
  }

  // ---- Réactions optimistes (feature #9) ----
  function onReactionClick(btn, groupId) {
    if (!window.SupabaseClient?.isLoggedIn()) return;
    const poopId = btn.dataset.poopId;
    const emoji  = btn.dataset.emoji;
    const item = _feedItems.find(i => i.id === poopId);
    if (!item) return;

    const prev = item.myReaction;
    if (prev === emoji) {
      item.reactions[emoji] = (item.reactions[emoji] || 1) - 1;
      if (!item.reactions[emoji]) delete item.reactions[emoji];
      item.myReaction = null;
    } else {
      if (prev) {
        item.reactions[prev] = (item.reactions[prev] || 1) - 1;
        if (!item.reactions[prev]) delete item.reactions[prev];
      }
      item.reactions[emoji] = (item.reactions[emoji] || 0) + 1;
      item.myReaction = emoji;
    }
    updateReactionBar(poopId, groupId);

    window.SupabaseClient.toggleReaction(poopId, emoji).catch(e => {
      console.warn('reaction err', e);
      window.UI?.toast('Réaction non enregistrée', 'error');
      renderFeed(groupId);
    });
  }

  function updateReactionBar(poopId, groupId) {
    const item = _feedItems.find(i => i.id === poopId);
    const bar  = document.querySelector(`[data-feed-poop="${poopId}"] .reaction-bar`);
    if (!item || !bar) return;
    bar.innerHTML = REACTION_EMOJIS.map(e => reactionBtnHTML(item, e)).join('');
    bar.querySelectorAll('.reaction-btn').forEach(btn =>
      btn.addEventListener('click', () => onReactionClick(btn, groupId)));
  }

  // ---- Commentaires (feature #1) ----
  function updateCommentCount(poopId) {
    const item = _feedItems.find(i => i.id === poopId);
    const btn  = document.querySelector(`[data-comment-toggle="${poopId}"]`);
    if (btn && item) btn.textContent = item.commentCount > 0 ? `💬 ${item.commentCount}` : '💬 Commenter';
  }

  async function toggleComments(poopId, groupId) {
    const thread = document.querySelector(`[data-comment-thread="${poopId}"]`);
    if (!thread) return;
    if (_openComments.has(poopId)) {
      _openComments.delete(poopId);
      thread.style.display = 'none';
    } else {
      _openComments.add(poopId);
      thread.style.display = '';
      await loadComments(poopId, groupId);
    }
  }

  async function loadComments(poopId, groupId) {
    const thread = document.querySelector(`[data-comment-thread="${poopId}"]`);
    if (!thread) return;
    thread.innerHTML = '<div class="text-xs opacity-50 py-1">Chargement…</div>';
    try {
      const comments = await window.SupabaseClient.getPoopComments(poopId);
      const myId = window.SupabaseClient.getCurrentProfile()?.id;
      const item = _feedItems.find(i => i.id === poopId);
      const iOwnPoop = item && item.user_id === myId;
      if (item) { item.commentCount = comments.length; updateCommentCount(poopId); }

      thread.innerHTML = comments.map(c => `
        <div class="comment-item">
          <span>${c.avatar}</span>
          <div class="c-body"><span class="font-bold">${esc(c.username)}</span> ${esc(c.body)}</div>
          ${(c.user_id === myId || iOwnPoop) ? `<span class="c-del" data-del-comment="${c.id}">✕</span>` : ''}
        </div>`).join('') + `
        <div class="comment-input-row">
          <input class="comment-input" data-comment-input="${poopId}" placeholder="Un petit mot… 💬" maxlength="280" />
          <button class="comment-send" data-comment-send="${poopId}">Envoyer</button>
        </div>`;

      const input = thread.querySelector('.comment-input');
      const send  = thread.querySelector('.comment-send');
      const submit = async () => {
        const body = input.value.trim();
        if (!body) return;
        send.disabled = true;
        try {
          await window.SupabaseClient.addComment(poopId, body);
          input.value = '';
          await loadComments(poopId, groupId);
        } catch(e) { window.UI?.toast(e.message, 'error'); send.disabled = false; }
      };
      send.addEventListener('click', submit);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });

      thread.querySelectorAll('[data-del-comment]').forEach(x =>
        x.addEventListener('click', async () => {
          if (!(await window.UI.confirm('Supprimer ce commentaire ?', { danger: true, okLabel: 'Supprimer' }))) return;
          try {
            await window.SupabaseClient.deleteComment(x.dataset.delComment);
            await loadComments(poopId, groupId);
          } catch(e) { window.UI?.toast(e.message, 'error'); }
        }));
    } catch(e) {
      thread.innerHTML = `<div class="text-xs text-red-500">${esc(e.message)}</div>`;
    }
  }

  // ---- Nudge / poke (feature #2) ----
  async function onNudge(btn, groupId) {
    btn.disabled = true;
    const username = btn.dataset.username;
    try {
      await window.SupabaseClient.sendNudge(btn.dataset.nudge, groupId, '💩');
      window.UI?.toast(`Petit rappel envoyé à ${username} 👉💩`, 'success');
      btn.textContent = '✓ Relancée';
    } catch(e) { window.UI?.toast(e.message, 'error'); btn.disabled = false; }
  }

  // ============================================================
  //  DÉFI DE LA SEMAINE 🎯
  // ============================================================
  async function renderChallenge(groupId) {
    const titleEl     = document.getElementById('challenge-title');
    const barsEl      = document.getElementById('challenge-bars');
    const countdownEl = document.getElementById('challenge-countdown');
    if (!barsEl) return;

    barsEl.innerHTML = skeletonBars(3);

    try {
      const challenge  = await window.SupabaseClient.getOrCreateWeeklyChallenge(groupId);
      if (!challenge) { barsEl.innerHTML = '<div class="text-xs opacity-60">Aucun défi actif</div>'; return; }

      const meta = window.SupabaseClient.getChallengeMeta(challenge.type);
      if (titleEl) titleEl.textContent = challenge.title || meta.title;
      const chipEl = document.getElementById('challenge-chip');
      if (chipEl) chipEl.innerHTML = `<span class="challenge-chip">${meta.emoji} ${esc(meta.desc)}</span>`;

      // Afficher le bouton "Modifier" si créateur (feature 12)
      const editBtn  = document.getElementById('edit-challenge-btn');
      const myProfil = window.SupabaseClient.getCurrentProfile();
      const groups   = await window.SupabaseClient.getMyGroups();
      const group    = groups.find(g => g.id === groupId);
      const isCreator = group?.created_by === myProfil?.id;
      if (editBtn) {
        editBtn.classList.toggle('hidden', !isCreator);
        editBtn.onclick = async () => {
          const newTitle = await window.UI.prompt('Laisse vide pour revenir au titre par défaut.', {
            title: 'Personnaliser le défi', value: titleEl?.textContent || '', okLabel: 'Valider', maxlength: 80
          });
          const title = (newTitle || '').trim() || meta.title;
          try {
            await window.SupabaseClient.updateWeeklyChallengeTitle(groupId, title);
            if (titleEl) titleEl.textContent = title;
          } catch(e) { window.UI.toast('Erreur : ' + e.message, 'error'); }
        };
      }

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
              <span class="text-sm font-bold" style="color:var(--accent)">${p.count} ${meta.unit}</span>
            </div>
            <div style="height:10px;background:rgba(0,0,0,0.08);border-radius:99px;overflow:hidden">
              <div style="width:${pct}%;height:100%;border-radius:99px;background:${isMe ? 'var(--accent)' : '#94a3b8'};transition:width .6s ease"></div>
            </div>
          </div>`;
      }).join('');

    } catch(e) {
      barsEl.innerHTML = `<div class="text-xs text-red-500">${esc(e.message)}</div>`;
    }
  }

  // ============================================================
  //  HALL OF FAME / PALMARÈS (feature #5)
  // ============================================================
  async function renderHallOfFame(groupId) {
    const card = document.getElementById('hall-of-fame-card');
    const el   = document.getElementById('hall-of-fame');
    if (!card || !el) return;
    try {
      const wins = await window.SupabaseClient.getHallOfFame(groupId, 12);
      if (!wins.length) { card.classList.add('hidden'); return; }
      card.classList.remove('hidden');
      el.innerHTML = wins.map(w => {
        const meta = window.SupabaseClient.getChallengeMeta(w.challenge_type);
        const wk = new Date(w.week_start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        return `
          <div class="hof-row">
            <span class="text-lg">${meta.emoji}</span>
            <div class="flex-1 min-w-0">
              <div class="font-bold">${w.avatar} ${esc(w.username)}</div>
              <div class="text-xs opacity-60">${esc(meta.desc)} · ${w.score ?? 0} ${esc(meta.unit)}</div>
            </div>
            <span class="hof-week">sem. ${wk}</span>
          </div>`;
      }).join('');
    } catch(e) { card.classList.add('hidden'); }
  }

  // ============================================================
  //  RÉCAP HEBDO « WRAPPED » (feature #7)
  // ============================================================
  async function renderWeeklyRecap(groupId) {
    const host = document.getElementById('weekly-recap');
    if (!host) return;
    try {
      const recap = await window.SupabaseClient.getWeeklyRecap(groupId);
      if (!recap || !recap.total) { host.innerHTML = ''; return; }
      const dismissKey = `cp_recap_dismissed_${groupId}_${recap.label}`;
      if (localStorage.getItem(dismissKey)) { host.innerHTML = ''; return; }

      host.innerHTML = `
        <div class="wrapped-card">
          <button class="wrapped-dismiss" id="recap-dismiss" title="Masquer">✕</button>
          <h4>📸 Récap de la semaine</h4>
          <div class="text-xs opacity-90 mt-1">${esc(recap.label)}</div>
          <div class="wrapped-grid">
            <div class="wrapped-stat"><div class="ws-val">${recap.total} 💩</div><div class="ws-label">${recap.kg} kg au total</div></div>
            <div class="wrapped-stat"><div class="ws-val">${recap.champ.avatar || '👑'} ${esc(recap.champ.username || '—')}</div><div class="ws-label">👑 Championne (${recap.champ.count})</div></div>
            ${recap.topDay ? `<div class="wrapped-stat"><div class="ws-val" style="text-transform:capitalize">${esc(recap.topDay.day)}</div><div class="ws-label">Jour le + actif (${recap.topDay.count})</div></div>` : ''}
            ${recap.topEmoji ? `<div class="wrapped-stat"><div class="ws-val">${recap.topEmoji.emoji} ×${recap.topEmoji.count}</div><div class="ws-label">Réaction star de la semaine</div></div>` : ''}
          </div>
        </div>`;
      document.getElementById('recap-dismiss')?.addEventListener('click', () => {
        localStorage.setItem(dismissKey, '1');
        host.innerHTML = '';
      });
    } catch(e) { host.innerHTML = ''; }
  }

  // ============================================================
  //  COURONNE REINE DU MOIS (feature #6)
  // ============================================================
  async function updateQueenCrown() {
    try {
      const badge = document.getElementById('user-badge');
      if (!badge) return;
      const crown = await window.SupabaseClient.myMonthlyCrown();
      let el = document.getElementById('queen-crown');
      if (crown) {
        if (!el) {
          el = document.createElement('span');
          el.id = 'queen-crown';
          badge.insertBefore(el, document.getElementById('user-avatar'));
        }
        el.textContent = '👑';
        el.title = `Reine du mois de « ${crown.group} » (${crown.count} 💩)`;
      } else if (el) {
        el.remove();
      }
    } catch(e) { /* silencieux */ }
  }

  // ============================================================
  //  CÉLÉBRATION GAGNANTE DE DÉFI (feature #5)
  // ============================================================
  async function checkWinnerCelebration(groupId) {
    try {
      const myId = window.SupabaseClient.getCurrentProfile()?.id;
      if (!myId) return;
      const wins = await window.SupabaseClient.getHallOfFame(groupId, 4);
      const last = wins[0];
      if (!last || last.user_id !== myId) return;
      const key = `cp_winner_celebrated_${groupId}_${last.week_start}`;
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
      showWinnerCelebration(last);
    } catch(e) { /* silencieux */ }
  }

  function showWinnerCelebration(win) {
    const meta = window.SupabaseClient.getChallengeMeta(win.challenge_type);
    const overlay = document.createElement('div');
    overlay.className = 'winner-overlay';
    overlay.innerHTML = `
      <div class="winner-card">
        <div class="winner-crown">👑</div>
        <h3 style="font-weight:800;font-size:20px;margin:8px 0">Tu as gagné le défi ! 🎉</h3>
        <p style="font-size:14px;opacity:.8">${meta.emoji} ${esc(meta.desc)} — ${win.score ?? 0} ${esc(meta.unit)}</p>
        <button class="ui-btn ui-btn-primary" id="winner-close" style="margin-top:18px">🎉 Trop forte !</button>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
    if (typeof window.rainbowConfetti === 'function') window.rainbowConfetti();
    else if (typeof window.showConfetti === 'function') window.showConfetti();
    document.getElementById('winner-close')?.addEventListener('click', () => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 250);
    });
  }

  // ============================================================
  //  GESTION DU GROUPE ⚙️
  // ============================================================
  async function renderMembersManagement(groupId) {
    const listEl      = document.getElementById('members-management-list');
    const deleteBtn   = document.getElementById('delete-group-btn');
    const leaveBtn    = document.getElementById('leave-group-btn');
    if (!listEl) return;

    listEl.innerHTML = skeletonBars(3);

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
          } catch(err) { window.UI.toast('Erreur : ' + err.message, 'error'); }
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
          if (!(await window.UI.confirm(`Retirer ${username} du groupe ?`, { title: 'Retirer un membre', okLabel: 'Retirer', danger: true }))) return;
          btn.disabled = true;
          try {
            await window.SupabaseClient.removeMember(groupId, btn.dataset.userId);
            await renderMembersManagement(groupId);
            await renderGroupContent(groupId);
          } catch(e) { window.UI.toast('Erreur : ' + e.message, 'error'); btn.disabled = false; }
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
  // ============================================================
  //  REALTIME — feed & réactions en direct (v2.10.0)
  // ============================================================
  let _rtChannel = null;
  let _rtRefreshTimer = null;

  function scheduleRealtimeRefresh() {
    // Débounce : plusieurs événements WAL rapprochés → un seul re-render
    clearTimeout(_rtRefreshTimer);
    _rtRefreshTimer = setTimeout(async () => {
      if (!_activeGroupId || !window.SupabaseClient?.isLoggedIn()) return;
      try {
        await Promise.all([
          renderPodium(_activeGroupId),
          renderCompareChart(_activeGroupId),
          renderFeed(_activeGroupId),
          renderChallenge(_activeGroupId)
        ]);
      } catch (e) { console.warn('Realtime refresh échoué', e); }
    }, 400);
  }

  function initRealtime() {
    const sb = window.SupabaseClient.getClient?.();
    if (!sb || _rtChannel) return;
    _rtChannel = sb.channel('social-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poops' }, scheduleRealtimeRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, scheduleRealtimeRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, scheduleRealtimeRefresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed_events' }, scheduleRealtimeRefresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'nudges' }, payload => {
        const n = payload?.new;
        if (n && n.to_user === window.SupabaseClient.getCurrentProfile()?.id) {
          window.UI?.toast(`${n.emoji || '💩'} Une copine te relance… à toi de jouer !`, 'party', 4500);
        }
      })
      .subscribe();
  }

  async function afterLogin() {
    const profile = window.SupabaseClient.getCurrentProfile();
    if (!profile) return;
    window.updateUserBadge?.(profile);
    updateQueenCrown();

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
      const name = await window.UI.prompt('', { title: 'Nouveau groupe', placeholder: 'Les Copines 💩', okLabel: 'Créer', maxlength: 40 });
      if (!name) return;
      try {
        const group = await window.SupabaseClient.createGroup(name);
        window.UI.toast(`Groupe créé ! Code d'invitation : ${group.invite_code} 🎉`, 'success', 5000);
        await renderGroupList();
      } catch(e) { window.UI.toast('Erreur : ' + e.message, 'error'); }
    });

    // Rejoindre un groupe
    document.getElementById('join-group-btn')?.addEventListener('click', async () => {
      const code = document.getElementById('invite-code-input')?.value.trim();
      if (!code) return;
      try {
        const group = await window.SupabaseClient.joinGroup(code);
        document.getElementById('invite-code-input').value = '';
        window.UI.toast(`Tu as rejoint « ${group.name} » ! 🎉`, 'success');
        await renderGroupList();
      } catch(e) { window.UI.toast('Erreur : ' + e.message, 'error'); }
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
      if (!(await window.UI.confirm('Quitter ce groupe ?', { title: 'Quitter le groupe', okLabel: 'Quitter', danger: true }))) return;
      try {
        await window.SupabaseClient.leaveGroup(_activeGroupId);
        document.getElementById('group-management').classList.add('hidden');
        await renderGroupList();
      } catch(e) { window.UI.toast('Erreur : ' + e.message, 'error'); }
    });

    // Supprimer le groupe
    document.getElementById('delete-group-btn')?.addEventListener('click', async () => {
      if (!(await window.UI.confirm('Supprimer définitivement ce groupe et toutes ses données ? Action irréversible.', { title: 'Supprimer le groupe', okLabel: 'Supprimer', danger: true }))) return;
      try {
        await window.SupabaseClient.deleteGroup(_activeGroupId);
        document.getElementById('group-management').classList.add('hidden');
        _activeGroupId = null;
        await renderGroupList();
      } catch(e) { window.UI.toast('Erreur : ' + e.message, 'error'); }
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
