// ============================================================
//  💬 CHAT DE GROUPE — fil temps réel par groupe (v2.22.0)
//
//  Depuis v2.23.0 le chat est un ONGLET du Social (plus une modale) :
//  il se rend dans #social-pane-chat, ouvert par l'onglet « 💬 Chat ».
//  La réception en direct reste sur `group_messages` (migration 18).
//  Le COMPTAGE des non-lus, lui, est fait par social.js qui garde un
//  abonnement permanent même quand l'onglet chat est fermé.
// ============================================================

window.ChatModule = (() => {

  let _groupId = null;
  let _channel = null;
  let _profileMap = {};
  let _renderTimer = null;
  let _lastMessages = [];

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  const timeOf = ts => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const DUEL_GAME_LABELS = {
    plop:    { emoji: '🚽', nom: 'Plop!' },
    pq:      { emoji: '🧻', nom: 'Tour de PQ' },
    colon:   { emoji: '🐍', nom: 'Le Côlon' },
    course:  { emoji: '🏃‍♀️', nom: 'Course au trône' },
    quiz:    { emoji: '🕵️', nom: 'Qui a fait ce caca ?' },
    transit: { emoji: '🌽', nom: 'Le Grand Transit' },
    fosse:   { emoji: '🌻', nom: 'Fosse septique tycoon' },
  };

  function gameLabel(gameId) {
    const meta = window.JeuxCore?.jeuMeta?.(gameId) || DUEL_GAME_LABELS[gameId];
    return meta ? `${meta.emoji} ${meta.nom}` : `🎮 ${gameId}`;
  }

  function parseDuel(body) {
    if (window.SocialLiveModule?.parseDuelMessage) return window.SocialLiveModule.parseDuelMessage(body);
    const raw = String(body ?? '').trim();
    if (!raw || raw.length > 500) return null;
    const m = /^\[duel:([a-z0-9_-]+):([a-zA-Z0-9_-]+):(\d+):([^\[\]:\r\n]+)\]$/.exec(raw);
    return (m && m[4].trim()) ? { game: m[1], seed: m[2], score: Number(m[3]), pseudo: m[4].trim() } : null;
  }

  function parsePoll(body) {
    if (window.SocialLiveModule?.parsePollMessage) return window.SocialLiveModule.parsePollMessage(body);
    const raw = String(body ?? '').trim();
    if (!raw || raw.length > 500) return null;
    const m = /^\[poll:([^\|\[\]\r\n]+)\|([^\|\[\]\r\n]+)\|([^\|\[\]\r\n]+)\]$/.exec(raw);
    if (!m) return null;
    const q = m[1].trim(), a = m[2].trim(), b = m[3].trim();
    return (q && a && b) ? { question: q, options: [a, b] } : null;
  }

  function parseSpot(body) {
    if (window.SocialLiveModule?.parseSpotMessage) return window.SocialLiveModule.parseSpotMessage(body);
    const raw = String(body ?? '').trim();
    if (!raw || raw.length > 500) return null;
    const m = /^\[spot:([^\|\[\]\r\n]+)\|([1-5])\|([01])\|([01])\|([01])\|([^\|\[\]\r\n]*)\]$/.exec(raw);
    if (!m || !m[1].trim()) return null;
    return {
      name: m[1].trim(),
      stars: Number(m[2]),
      pq: m[3] === '1',
      clean: m[4] === '1',
      lock: m[5] === '1',
      note: m[6].trim(),
    };
  }

  function readPollVote(pollKey) {
    if (window.SocialLiveModule?.getPollVote) return window.SocialLiveModule.getPollVote(pollKey);
    try {
      const map = JSON.parse(localStorage.getItem('chat.polls.v1') || '{}');
      const v = map?.[String(pollKey)];
      return (v === 0 || v === 1) ? v : null;
    } catch { return null; }
  }

  function savePollVote(pollKey, idx) {
    if (window.SocialLiveModule?.votePoll) return window.SocialLiveModule.votePoll(pollKey, idx);
    try {
      const map = JSON.parse(localStorage.getItem('chat.polls.v1') || '{}') || {};
      map[String(pollKey)] = idx;
      localStorage.setItem('chat.polls.v1', JSON.stringify(map));
      return idx;
    } catch { return null; }
  }

  function decorate(row) {
    return {
      ...row,
      username: _profileMap[row.user_id]?.username || '???',
      avatar:   _profileMap[row.user_id]?.avatar   || '💩',
      mine:     row.user_id === window.SupabaseClient?.getCurrentProfile()?.id,
    };
  }

  function renderQuoteOrTextHTML(rawBody, mine) {
    const text = String(rawBody ?? '');
    if (!/^>\s*/.test(text) || text.trim() === '>') {
      return esc(text);
    }
    const quoteBoxStyle = mine
      ? 'margin:0 0 6px;padding:5px 8px;border-left:3px solid rgba(255,255,255,.75);border-radius:6px;background:rgba(0,0,0,.15);font-size:12px;opacity:.92'
      : 'margin:0 0 6px;padding:5px 8px;border-left:3px solid var(--accent);border-radius:6px;background:color-mix(in srgb,var(--accent) 12%,transparent);font-size:12px;opacity:.88';

    // Multi-lignes commençant par `> `
    if (text.includes('\n')) {
      const lines = text.split(/\r?\n/);
      const quoted = [];
      let i = 0;
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoted.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      const rest = lines.slice(i).join('\n').trim();
      return `<blockquote class="chat-quote" style="${quoteBoxStyle}">${esc(quoted.join('\n'))}</blockquote>${rest ? `<div>${esc(rest)}</div>` : ''}`;
    }

    // Ligne unique issue du pré-remplissage `> @pseudo : réponse`
    const replyMatch = /^>\s*(@[^:\r\n]{1,60}\s*:)\s*(.+)$/.exec(text);
    if (replyMatch) {
      return `<blockquote class="chat-quote" style="${quoteBoxStyle}">${esc(replyMatch[1].trim())}</blockquote><div>${esc(replyMatch[2])}</div>`;
    }

    const stripped = text.replace(/^>\s*/, '');
    return `<blockquote class="chat-quote" style="${quoteBoxStyle};margin-bottom:0">${esc(stripped)}</blockquote>`;
  }

  function renderRichBody(m) {
    const body = String(m?.body ?? '');

    const duel = parseDuel(body);
    if (duel) {
      return {
        isCard: true,
        html: `
          <div class="chat-card chat-card-duel" style="display:grid;gap:6px;min-width:190px">
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--accent)">⚔️ Duel 1v1</div>
            <div style="font-weight:800;font-size:14px">${esc(gameLabel(duel.game))}</div>
            <div style="font-size:12px;opacity:.85">
              <strong>${esc(duel.pseudo)}</strong> te défie · Score à battre : <strong>🏆 ${esc(duel.score)}</strong>
            </div>
            <button type="button" class="chat-duel-play-btn" data-duel-game="${esc(duel.game)}" data-duel-seed="${esc(duel.seed)}"
              style="margin-top:2px;padding:7px 12px;border-radius:999px;border:none;cursor:pointer;font-size:12px;font-weight:800;background:var(--accent);color:#fff">
              🎮 Jouer ce duel
            </button>
          </div>`,
      };
    }

    const poll = parsePoll(body);
    if (poll) {
      const pollKey = String(m?.id ?? m?.created_at ?? body);
      const myVote = readPollVote(pollKey);
      const optsHTML = poll.options.map((opt, idx) => {
        const active = myVote === idx;
        const btnStyle = active
          ? 'background:var(--accent);color:#fff;border:1.5px solid var(--accent)'
          : 'background:color-mix(in srgb,var(--accent) 10%,transparent);color:var(--text-primary);border:1.5px solid color-mix(in srgb,var(--accent) 28%,transparent)';
        return `
          <button type="button" class="chat-poll-opt ${active ? 'is-voted' : ''}"
            data-poll-key="${esc(pollKey)}" data-poll-idx="${idx}"
            style="width:100%;text-align:left;padding:7px 10px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;${btnStyle}">
            ${active ? '✅ ' : '⚪ '}${esc(opt)}
          </button>`;
      }).join('');
      return {
        isCard: true,
        html: `
          <div class="chat-card chat-card-poll" style="display:grid;gap:6px;min-width:195px">
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--accent)">📊 Sondage express</div>
            <div style="font-weight:800;font-size:13px">${esc(poll.question)}</div>
            <div style="display:grid;gap:5px;margin-top:2px">${optsHTML}</div>
          </div>`,
      };
    }

    const spot = parseSpot(body);
    if (spot) {
      const starsStr = '⭐'.repeat(spot.stars) + '☆'.repeat(5 - spot.stars);
      return {
        isCard: true,
        html: `
          <div class="chat-card chat-card-spot" style="display:grid;gap:6px;min-width:195px">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
              <span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--accent)">📍 Toilettes Advisor</span>
              <span style="font-size:11px;font-weight:800" title="${esc(spot.stars)}/5">${starsStr}</span>
            </div>
            <div style="font-weight:800;font-size:14px">${esc(spot.name)}</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;font-size:11px;font-weight:700">
              <span style="padding:2px 7px;border-radius:999px;background:color-mix(in srgb,${spot.pq ? '#10b981' : '#ef4444'} 16%,transparent)">${spot.pq ? '🧻 PQ' : '🚫 Sans PQ'}</span>
              <span style="padding:2px 7px;border-radius:999px;background:color-mix(in srgb,${spot.clean ? '#10b981' : '#f59e0b'} 16%,transparent)">${spot.clean ? '✨ Propre' : '⚠️ Moyen'}</span>
              <span style="padding:2px 7px;border-radius:999px;background:color-mix(in srgb,${spot.lock ? '#10b981' : '#f59e0b'} 16%,transparent)">${spot.lock ? '🔒 Verrou' : '🚪 Sans verrou'}</span>
            </div>
            ${spot.note ? `<div class="chat-spot-note" style="font-size:12px;opacity:.85;font-style:italic">« ${esc(spot.note)} »</div>` : ''}
          </div>`,
      };
    }

    return {
      isCard: false,
      html: renderQuoteOrTextHTML(body, !!m?.mine),
    };
  }

  function messageHTML(m) {
    const mine = !!m.mine;
    const rich = renderRichBody(m);
    const bubbleStyle = rich.isCard
      ? 'background:color-mix(in srgb,var(--accent) 10%,var(--card-bg));color:var(--text-primary);border:1.5px solid color-mix(in srgb,var(--accent) 30%,var(--card-border))'
      : (mine
        ? 'background:var(--accent);color:#fff'
        : 'background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--text-primary)');
    const authorName = m.username || (mine ? (window.SupabaseClient?.getCurrentProfile?.()?.username || 'Moi') : '???');
    const ts = m.created_at ? timeOf(new Date(m.created_at).getTime()) : '';
    return `
      <div class="chat-row ${mine ? 'chat-row-mine' : ''}">
        ${mine ? '' : `<span class="chat-avatar">${esc(m.avatar || '💩')}</span>`}
        <div class="chat-bubble-wrap">
          ${mine ? '' : `<div class="chat-author">${esc(m.username)}</div>`}
          <div class="chat-bubble" style="${bubbleStyle}">${rich.html}</div>
          <div class="chat-meta ${mine ? 'text-right' : ''}" style="display:flex;align-items:center;gap:6px;justify-content:${mine ? 'flex-end' : 'flex-start'}">
            <span class="chat-time">${ts}</span>
            <button type="button" class="chat-reply-btn" data-reply-user="${esc(authorName)}"
              title="Répondre" aria-label="Répondre à ${esc(authorName)}"
              style="border:none;background:none;padding:0 2px;font-size:11px;opacity:.55;cursor:pointer">↩️</button>
          </div>
        </div>
      </div>`;
  }

  function replyToUser(username) {
    const input = document.getElementById('chat-input');
    if (!input) return;
    const clean = String(username || 'Anonyme').replace(/[\r\n]+/g, ' ').trim() || 'Anonyme';
    const prefix = `> @${clean} : `;
    const existing = String(input.value || '');
    input.value = existing && !existing.startsWith('> @') ? `${prefix}${existing}` : prefix;
    input.focus?.();
    try { input.setSelectionRange?.(input.value.length, input.value.length); } catch {}
  }

  function isNearBottom() {
    const el = document.getElementById('chat-messages');
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  }

  function scrollBottom() {
    const el = document.getElementById('chat-messages');
    if (el) el.scrollTop = el.scrollHeight;
  }

  function bindMessagesDelegation() {
    const el = document.getElementById('chat-messages');
    if (!el || el._chatDelegated) return;
    el._chatDelegated = true;
    el.addEventListener?.('click', e => {
      const duelBtn = e.target?.closest?.('[data-duel-game]');
      if (duelBtn) {
        const gameId = duelBtn.dataset.duelGame;
        if (typeof openJeux === 'function') openJeux(gameId);
        else if (typeof window.openJeux === 'function') window.openJeux(gameId);
        else window.UI?.toast?.('Jeux du trône indisponibles ici', 'info');
        return;
      }

      const pollBtn = e.target?.closest?.('[data-poll-key]');
      if (pollBtn) {
        const key = pollBtn.dataset.pollKey;
        const idx = Number(pollBtn.dataset.pollIdx);
        savePollVote(key, idx);
        if (_lastMessages.length) {
          el.innerHTML = _lastMessages.map(messageHTML).join('');
        } else {
          scheduleRender();
        }
        return;
      }

      const replyBtn = e.target?.closest?.('[data-reply-user]');
      if (replyBtn) {
        replyToUser(replyBtn.dataset.replyUser);
      }
    });
  }

  async function render() {
    const el = document.getElementById('chat-messages');
    if (!el || !_groupId) return;
    bindMessagesDelegation();
    if (!window.SupabaseClient.groupChatAvailable()) {
      el.innerHTML = '<div class="text-center text-sm opacity-50 py-6">Le chat n\'est pas encore disponible sur ce serveur.</div>';
      return;
    }
    const stick = isNearBottom();
    try {
      const msgs = await window.SupabaseClient.getGroupMessages(_groupId, 50);
      _lastMessages = msgs;
      if (!msgs.length) {
        el.innerHTML = '<div class="text-center text-sm opacity-50 py-6">Aucun message — lance la discussion ! 💬</div>';
        return;
      }
      el.innerHTML = msgs.map(messageHTML).join('');
      if (stick) scrollBottom();
    } catch (e) {
      el.innerHTML = `<div class="text-center text-sm opacity-60 py-6">${esc(e.message)}</div>`;
    }
  }

  function scheduleRender() {
    clearTimeout(_renderTimer);
    _renderTimer = setTimeout(render, 200);
  }

  function subscribe() {
    const sb = window.SupabaseClient?.getClient?.();
    if (!sb || !_groupId) return;
    _channel = sb.channel('group-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, payload => {
        if (payload?.new?.group_id === _groupId) scheduleRender();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_messages' }, payload => {
        if (payload?.old?.group_id === _groupId) scheduleRender();
      })
      .subscribe();
  }

  async function sendBody(rawBody) {
    const body = String(rawBody ?? '').trim();
    if (!body || !_groupId) return false;
    try {
      await window.SupabaseClient.sendGroupMessage(_groupId, body);
      scheduleRender();
      return true;
    } catch (e) {
      window.UI?.toast?.('Envoi impossible : ' + e.message, 'error');
      return false;
    }
  }

  async function handleQuickDuel() {
    if (!_groupId) return;
    const options = [
      { value: 'plop',    label: '🚽 Plop!',             sub: 'Précision chirurgicale' },
      { value: 'pq',      label: '🧻 Tour de PQ',        sub: 'Empile les rouleaux' },
      { value: 'colon',   label: '🐍 Le Côlon',          sub: 'Fibres & réflexes' },
      { value: 'course',  label: '🏃‍♀️ Course au trône', sub: 'Sprint d\'urgence' },
      { value: 'transit', label: '🌽 Le Grand Transit',  sub: 'Odyssée digestive' },
    ];
    const gameId = window.UI?.choose
      ? await window.UI.choose({ title: '⚔️ Lancer un Duel 1v1', message: 'Choisis le jeu sur lequel défier le groupe :', options })
      : 'plop';
    if (!gameId) return;

    let bestScore = 0;
    try {
      const stats = JSON.parse(localStorage.getItem('jeux.stats.v1') || 'null');
      bestScore = Math.max(0, Math.floor(Number(stats?.best?.[gameId]) || 0));
    } catch {}
    const seed = String(Math.floor(1000 + Math.random() * 900000));
    const pseudo = window.SupabaseClient?.getCurrentProfile?.()?.username || 'Moi';
    const encoded = window.SocialLiveModule?.formatDuelMessage
      ? window.SocialLiveModule.formatDuelMessage(gameId, seed, bestScore, pseudo)
      : `[duel:${gameId}:${seed}:${bestScore}:${pseudo.replace(/[:\[\]\r\n]+/g, ' ').trim() || 'Moi'}]`;
    if (encoded) await sendBody(encoded);
  }

  function handleQuickPoll() {
    if (!_groupId) return;
    if (window.SocialLiveModule?.openCreatePollModal) {
      window.SocialLiveModule.openCreatePollModal(encoded => {
        if (encoded) sendBody(encoded);
      });
    }
  }

  function handleQuickSpot() {
    if (!_groupId) return;
    if (window.SocialLiveModule?.openAddSpotModal) {
      window.SocialLiveModule.openAddSpotModal((_saved, encoded) => {
        if (encoded) sendBody(encoded);
      });
    }
  }

  function bindChatControls() {
    const sendBtn = document.getElementById('chat-send');
    if (sendBtn && !sendBtn._chatBound) {
      sendBtn._chatBound = true;
      sendBtn.addEventListener?.('click', send);
    }
    const input = document.getElementById('chat-input');
    if (input && !input._chatBound) {
      input._chatBound = true;
      input.addEventListener?.('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
      });
    }
    const duelBtn = document.getElementById('chat-duel-btn');
    if (duelBtn && !duelBtn._chatBound) {
      duelBtn._chatBound = true;
      duelBtn.addEventListener?.('click', handleQuickDuel);
    }
    const pollBtn = document.getElementById('chat-poll-btn');
    if (pollBtn && !pollBtn._chatBound) {
      pollBtn._chatBound = true;
      pollBtn.addEventListener?.('click', handleQuickPoll);
    }
    const spotBtn = document.getElementById('chat-spot-btn');
    if (spotBtn && !spotBtn._chatBound) {
      spotBtn._chatBound = true;
      spotBtn.addEventListener?.('click', handleQuickSpot);
    }
    bindMessagesDelegation();
  }

  async function open(groupId) {
    bindChatControls();
    if (!groupId || groupId === _groupId) return;
    // Nettoyer l'abonnement de l'ancien groupe avant d'en ouvrir un autre.
    try { _channel?.unsubscribe?.(); } catch {}
    _channel = null;
    _groupId = groupId;
    _lastMessages = [];

    const members = await window.SupabaseClient.getGroupMembers(groupId).catch(() => []);
    _profileMap = Object.fromEntries(members.map(m => [m.id, m]));

    const list = document.getElementById('chat-messages');
    if (list) list.innerHTML = '<div class="text-center text-sm opacity-50 py-4">Chargement…</div>';

    subscribe();
    await render();
    document.getElementById('chat-input')?.focus();
  }

  function close() {
    _groupId = null;
    _lastMessages = [];
    clearTimeout(_renderTimer);
    try { _channel?.unsubscribe?.(); } catch {}
    _channel = null;
  }

  async function send() {
    const input = document.getElementById('chat-input');
    const body = input?.value?.trim();
    if (!body || !_groupId) return;
    input.value = '';
    input.focus();
    await sendBody(body);
  }

  // ---- Event listeners ----
  document.addEventListener('DOMContentLoaded', bindChatControls);

  return { open, close, send, groupId: () => _groupId, messageHTML, replyToUser };
})();
