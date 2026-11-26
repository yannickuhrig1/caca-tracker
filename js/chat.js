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
  let _reactionsMap = {};
  let _openPickerMsgId = null;

  const ALLOWED_REACTIONS = ['😂', '💩', '🔥', '💀', '❤️'];

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  const timeOf = ts => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  function encodeReaction(msgId, emoji) {
    const id = String(msgId ?? '').replace(/[\|\[\]\r\n]+/g, '').trim();
    const em = String(emoji ?? '').replace(/[\|\[\]\r\n]+/g, '').trim();
    if (!id || !em) return null;
    return `[react:${id}|${em}]`;
  }

  function decodeReaction(content) {
    const raw = String(content ?? '').trim();
    if (!raw || raw.length > 500) return null;
    const m = /^\[react:([^\|\[\]\r\n]+)\|([^\|\[\]\r\n]+)\]$/.exec(raw);
    if (!m) return null;
    const msgId = m[1].trim(), emoji = m[2].trim();
    return (msgId && emoji) ? { msgId, emoji } : null;
  }

  function encodePin(msgId, excerpt) {
    const id = String(msgId ?? '').replace(/[\|\[\]\r\n]+/g, '').trim();
    const text = String(excerpt ?? '').replace(/[\|\[\]\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!id || !text) return null;
    return `[pin:${id}|${text}]`;
  }

  function decodePin(content) {
    const raw = String(content ?? '').trim();
    if (!raw || raw.length > 500) return null;
    const m = /^\[pin:([^\|\[\]\r\n]+)\|([^\|\[\]\r\n]+)\]$/.exec(raw);
    if (!m) return null;
    const msgId = m[1].trim(), excerpt = m[2].trim();
    return (msgId && excerpt) ? { msgId, excerpt } : null;
  }

  function encodeBet(question, options) {
    const q = String(question ?? '').replace(/[\|\[\]\r\n]+/g, ' ').trim().slice(0, 140);
    const list = Array.isArray(options) ? options : String(options ?? '').split('/');
    const o1 = String(list[0] ?? '').replace(/[\|\[\]\/\r\n]+/g, ' ').trim().slice(0, 60);
    const o2 = String(list[1] ?? '').replace(/[\|\[\]\/\r\n]+/g, ' ').trim().slice(0, 60);
    if (!q || !o1 || !o2) return null;
    return `[bet:${q}|${o1}/${o2}]`;
  }

  function decodeBet(content) {
    const raw = String(content ?? '').trim();
    if (!raw || raw.length > 500) return null;
    const m = /^\[bet:([^\|\[\]\r\n]+)\|([^\|\[\]\/\r\n]+)\/([^\|\[\]\/\r\n]+)\]$/.exec(raw);
    if (!m) return null;
    const question = m[1].trim(), o1 = m[2].trim(), o2 = m[3].trim();
    return (question && o1 && o2) ? { question, options: [o1, o2] } : null;
  }

  function encode1v1(target, criteria) {
    const t = String(target ?? '').replace(/[\|\[\]\r\n]+/g, ' ').trim().slice(0, 60);
    const c = String(criteria ?? '').replace(/[\|\[\]\r\n]+/g, ' ').trim().slice(0, 120);
    if (!t || !c) return null;
    return `[1v1:${t}|${c}]`;
  }

  function decode1v1(content) {
    const raw = String(content ?? '').trim();
    if (!raw || raw.length > 500) return null;
    const m = /^\[1v1:([^\|\[\]\r\n]+)\|([^\|\[\]\r\n]+)\]$/.exec(raw);
    if (!m) return null;
    const target = m[1].trim(), criteria = m[2].trim();
    return (target && criteria) ? { target, criteria } : null;
  }

  function aggregateReactions(messages, currentUserId) {
    const map = {};
    const seen = {};
    for (const m of (messages || [])) {
      const r = decodeReaction(m?.body);
      if (!r) continue;
      if (!map[r.msgId]) map[r.msgId] = {};
      if (!seen[r.msgId]) seen[r.msgId] = {};
      if (!seen[r.msgId][r.emoji]) seen[r.msgId][r.emoji] = new Set();
      const actor = m.user_id ? String(m.user_id) : `__anon_${m.id ?? Math.random()}`;
      if (seen[r.msgId][r.emoji].has(actor)) continue;
      seen[r.msgId][r.emoji].add(actor);
      const prev = map[r.msgId][r.emoji] || { count: 0, mine: false };
      map[r.msgId][r.emoji] = {
        count: prev.count + 1,
        mine: prev.mine || (!!currentUserId && m.user_id === currentUserId),
      };
    }
    return map;
  }

  function extractLatestPin(messages) {
    let latest = null;
    for (const m of (messages || [])) {
      const p = decodePin(m?.body);
      if (p) latest = { ...p, created_at: m.created_at || null };
    }
    return latest;
  }

  function highlightMentions(rawText, mine) {
    const safe = esc(rawText);
    const mentionStyle = mine
      ? 'font-weight:800;background:rgba(255,255,255,.22);padding:0 4px;border-radius:6px'
      : 'font-weight:800;color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,transparent);padding:0 4px;border-radius:6px';
    return safe.replace(/(^|[\s(>])@([a-zA-Z0-9_\u00C0-\u024F-]{1,32})/g,
      (_, prefix, name) => `${prefix}<span class="chat-mention" style="${mentionStyle}">@${name}</span>`);
  }

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

  function readLocalMapVote(storageKey, itemKey) {
    try {
      const map = JSON.parse(localStorage.getItem(storageKey) || '{}');
      const v = map?.[String(itemKey)];
      return v !== undefined ? v : null;
    } catch { return null; }
  }

  function saveLocalMapVote(storageKey, itemKey, val) {
    try {
      const map = JSON.parse(localStorage.getItem(storageKey) || '{}') || {};
      map[String(itemKey)] = val;
      localStorage.setItem(storageKey, JSON.stringify(map));
      return val;
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
      return highlightMentions(text, mine);
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
      return `<blockquote class="chat-quote" style="${quoteBoxStyle}">${esc(quoted.join('\n'))}</blockquote>${rest ? `<div>${highlightMentions(rest, mine)}</div>` : ''}`;
    }

    // Ligne unique issue du pré-remplissage `> @pseudo : réponse`
    const replyMatch = /^>\s*(@[^:\r\n]{1,60}\s*:)\s*(.+)$/.exec(text);
    if (replyMatch) {
      return `<blockquote class="chat-quote" style="${quoteBoxStyle}">${esc(replyMatch[1].trim())}</blockquote><div>${highlightMentions(replyMatch[2], mine)}</div>`;
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

    const bet = decodeBet(body);
    if (bet) {
      const betKey = String(m?.id ?? m?.created_at ?? body);
      const myBet = readLocalMapVote('chat.bets.v1', betKey);
      const optsHTML = bet.options.map((opt, idx) => {
        const active = myBet === idx;
        const btnStyle = active
          ? 'background:var(--accent);color:#fff;border:1.5px solid var(--accent)'
          : 'background:color-mix(in srgb,var(--accent) 10%,transparent);color:var(--text-primary);border:1.5px solid color-mix(in srgb,var(--accent) 28%,transparent)';
        return `
          <button type="button" class="chat-bet-opt ${active ? 'is-voted' : ''}"
            data-bet-key="${esc(betKey)}" data-bet-idx="${idx}"
            style="width:100%;text-align:left;padding:7px 10px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;${btnStyle}">
            ${active ? '🎯 ' : '🔮 '}${esc(opt)}
          </button>`;
      }).join('');
      return {
        isCard: true,
        html: `
          <div class="chat-card chat-card-bet" style="display:grid;gap:6px;min-width:195px">
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--accent)">🔮 Pari du jour</div>
            <div style="font-weight:800;font-size:13px">${esc(bet.question)}</div>
            <div style="display:grid;gap:5px;margin-top:2px">${optsHTML}</div>
          </div>`,
      };
    }

    const challenge = decode1v1(body);
    if (challenge) {
      const cKey = String(m?.id ?? m?.created_at ?? body);
      const accepted = !!readLocalMapVote('chat.1v1.v1', cKey);
      const btnStyle = accepted
        ? 'background:#10b981;color:#fff'
        : 'background:var(--accent);color:#fff';
      return {
        isCard: true,
        html: `
          <div class="chat-card chat-card-1v1" style="display:grid;gap:6px;min-width:195px">
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--accent)">⚔️ Défi 1v1</div>
            <div style="font-weight:800;font-size:13px">Cible : ${highlightMentions('@' + challenge.target.replace(/^@+/, ''), false)}</div>
            <div style="font-size:12px;opacity:.88">${esc(challenge.criteria)}</div>
            <button type="button" class="chat-1v1-accept-btn ${accepted ? 'is-accepted' : ''}" data-1v1-key="${esc(cKey)}"
              style="margin-top:2px;padding:7px 12px;border-radius:999px;border:none;cursor:pointer;font-size:12px;font-weight:800;${btnStyle}">
              ${accepted ? '✅ Défi relevé !' : '🤝 Relever le défi'}
            </button>
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

  function messageExcerpt(m) {
    const raw = String(m?.body ?? '').replace(/[\|\[\]\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    return raw.slice(0, 80) || 'Message';
  }

  function renderReactionsHTML(msgId, reactionsMap, mine) {
    const entry = reactionsMap?.[msgId];
    if (!entry) return '';
    const pills = Object.entries(entry).map(([emoji, info]) => {
      const activeStyle = info.mine
        ? 'border:1px solid var(--accent);background:color-mix(in srgb,var(--accent) 18%,transparent)'
        : 'border:1px solid var(--card-border);background:var(--card-bg)';
      return `<button type="button" class="chat-reaction-pill ${info.mine ? 'is-mine' : ''}" data-react-send-msg="${esc(msgId)}" data-react-emoji="${esc(emoji)}" style="padding:1px 6px;border-radius:999px;font-size:11px;font-weight:700;cursor:pointer;${activeStyle}">${esc(emoji)} ${info.count}</button>`;
    }).join('');
    return pills ? `<div class="chat-reactions" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;justify-content:${mine ? 'flex-end' : 'flex-start'}">${pills}</div>` : '';
  }

  function messageHTML(m, reactionsMap) {
    const mine = !!m.mine;
    const msgId = String(m?.id ?? '');
    const rich = renderRichBody(m);
    const bubbleStyle = rich.isCard
      ? 'background:color-mix(in srgb,var(--accent) 10%,var(--card-bg));color:var(--text-primary);border:1.5px solid color-mix(in srgb,var(--accent) 30%,var(--card-border))'
      : (mine
        ? 'background:var(--accent);color:#fff'
        : 'background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--text-primary)');
    const authorName = m.username || (mine ? (window.SupabaseClient?.getCurrentProfile?.()?.username || 'Moi') : '???');
    const ts = m.created_at ? timeOf(new Date(m.created_at).getTime()) : '';
    const rMap = reactionsMap || _reactionsMap || {};
    const reactionsHTML = msgId ? renderReactionsHTML(msgId, rMap, mine) : '';
    const pickerHTML = (msgId && _openPickerMsgId === msgId)
      ? `<div class="chat-react-picker" style="display:flex;gap:4px;margin-top:4px;padding:3px 6px;border-radius:999px;background:var(--card-bg);border:1px solid var(--card-border);width:fit-content">${ALLOWED_REACTIONS.map(em => `<button type="button" data-react-send-msg="${esc(msgId)}" data-react-emoji="${em}" style="border:none;background:none;font-size:14px;cursor:pointer;padding:1px 3px">${em}</button>`).join('')}</div>`
      : '';
    const actionBtns = msgId
      ? `<button type="button" class="chat-react-btn" data-react-msg="${esc(msgId)}" title="Réagir" aria-label="Réagir" style="border:none;background:none;padding:0 2px;font-size:11px;opacity:.65;cursor:pointer">+😀</button><button type="button" class="chat-pin-btn" data-pin-msg="${esc(msgId)}" data-pin-excerpt="${esc(messageExcerpt(m))}" title="Épingler" aria-label="Épingler" style="border:none;background:none;padding:0 2px;font-size:11px;opacity:.55;cursor:pointer">📌</button>`
      : '';
    return `
      <div class="chat-row ${mine ? 'chat-row-mine' : ''}" data-msg-id="${esc(msgId)}">
        ${mine ? '' : `<span class="chat-avatar">${esc(m.avatar || '💩')}</span>`}
        <div class="chat-bubble-wrap">
          ${mine ? '' : `<div class="chat-author">${esc(m.username)}</div>`}
          <div class="chat-bubble" style="${bubbleStyle}">${rich.html}</div>
          ${reactionsHTML}
          ${pickerHTML}
          <div class="chat-meta ${mine ? 'text-right' : ''}" style="display:flex;align-items:center;gap:6px;justify-content:${mine ? 'flex-end' : 'flex-start'}">
            <span class="chat-time">${ts}</span>
            ${actionBtns}
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

  function renderMessagesToElement(el, msgs) {
    if (!el) return;
    const myId = window.SupabaseClient?.getCurrentProfile?.()?.id || null;
    _reactionsMap = aggregateReactions(msgs, myId);
    const latestPin = extractLatestPin(msgs);
    const visibleMsgs = (msgs || []).filter(m => !decodeReaction(m?.body) && !decodePin(m?.body));
    const pinBannerHTML = latestPin
      ? `<div id="chat-pinned-banner" class="chat-pinned-banner" style="position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:6px;padding:7px 12px;margin-bottom:8px;border-radius:12px;background:color-mix(in srgb,var(--accent) 14%,var(--card-bg));border:1px solid color-mix(in srgb,var(--accent) 30%,var(--card-border));font-size:12px"><span>📌</span><strong style="white-space:nowrap">Épinglé :</strong><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(latestPin.excerpt)}</span></div>`
      : '';
    if (!visibleMsgs.length) {
      el.innerHTML = pinBannerHTML + '<div class="text-center text-sm opacity-50 py-6">Aucun message — lance la discussion ! 💬</div>';
      return;
    }
    el.innerHTML = pinBannerHTML + visibleMsgs.map(m => messageHTML(m, _reactionsMap)).join('');
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
        if (_lastMessages.length) renderMessagesToElement(el, _lastMessages);
        else scheduleRender();
        return;
      }

      const betBtn = e.target?.closest?.('[data-bet-key]');
      if (betBtn) {
        const key = betBtn.dataset.betKey;
        const idx = Number(betBtn.dataset.betIdx);
        saveLocalMapVote('chat.bets.v1', key, idx);
        if (_lastMessages.length) renderMessagesToElement(el, _lastMessages);
        else scheduleRender();
        return;
      }

      const acceptBtn = e.target?.closest?.('[data-1v1-key]');
      if (acceptBtn) {
        const key = acceptBtn.dataset['1v1Key'];
        const prev = !!readLocalMapVote('chat.1v1.v1', key);
        saveLocalMapVote('chat.1v1.v1', key, !prev);
        if (_lastMessages.length) renderMessagesToElement(el, _lastMessages);
        else scheduleRender();
        return;
      }

      const reactSendBtn = e.target?.closest?.('[data-react-send-msg]');
      if (reactSendBtn) {
        const msgId = reactSendBtn.dataset.reactSendMsg;
        const emoji = reactSendBtn.dataset.reactEmoji;
        _openPickerMsgId = null;
        const encoded = encodeReaction(msgId, emoji);
        if (encoded) sendBody(encoded);
        if (_lastMessages.length) renderMessagesToElement(el, _lastMessages);
        return;
      }

      const reactToggleBtn = e.target?.closest?.('[data-react-msg]');
      if (reactToggleBtn) {
        const msgId = reactToggleBtn.dataset.reactMsg;
        _openPickerMsgId = (_openPickerMsgId === msgId) ? null : msgId;
        if (_lastMessages.length) renderMessagesToElement(el, _lastMessages);
        return;
      }

      const pinBtn = e.target?.closest?.('[data-pin-msg]');
      if (pinBtn) {
        const msgId = pinBtn.dataset.pinMsg;
        const excerpt = pinBtn.dataset.pinExcerpt || 'Message';
        const encoded = encodePin(msgId, excerpt);
        if (encoded) sendBody(encoded);
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
      renderMessagesToElement(el, msgs);
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

  async function handleQuickBet() {
    if (!_groupId) return;
    const q = window.UI?.prompt
      ? await window.UI.prompt('Quelle est la question du pari ?', { title: '🔮 Pari du jour', placeholder: 'Ex : Qui pose avant midi ?', maxlength: 140 })
      : null;
    if (!q) return;
    const o1 = await window.UI.prompt('Option 1 :', { title: '🔮 Pari du jour', value: 'Oui 👍', maxlength: 60 });
    if (!o1) return;
    const o2 = await window.UI.prompt('Option 2 :', { title: '🔮 Pari du jour', value: 'Non 👎', maxlength: 60 });
    if (!o2) return;
    const encoded = encodeBet(q, [o1, o2]);
    if (encoded) await sendBody(encoded);
  }

  async function handleQuick1v1() {
    if (!_groupId) return;
    const myId = window.SupabaseClient?.getCurrentProfile?.()?.id;
    const members = Object.values(_profileMap).filter(m => m?.username && m.id !== myId);
    let target = null;
    if (members.length && window.UI?.choose) {
      target = await window.UI.choose({
        title: '⚔️ Défi 1v1',
        message: 'Qui veux-tu défier ?',
        options: members.map(m => ({ value: m.username, label: `${m.avatar || '💩'} ${m.username}` })),
      });
    } else if (window.UI?.prompt) {
      target = await window.UI.prompt('Pseudo de la cible :', { title: '⚔️ Défi 1v1', placeholder: 'Ex : Clémence', maxlength: 60 });
    }
    if (!target) return;
    const criteria = window.UI?.prompt
      ? await window.UI.prompt('Critère du défi :', { title: '⚔️ Défi 1v1', value: 'Premier à 2 cacas aujourd’hui', maxlength: 120 })
      : 'Premier à 2 cacas aujourd’hui';
    if (!criteria) return;
    const encoded = encode1v1(target, criteria);
    if (encoded) await sendBody(encoded);
  }

  function ensureQuickButtons() {
    const quickBar = document.getElementById('chat-quick-bar') || document.getElementById('chat-duel-btn')?.parentElement;
    if (!quickBar || typeof quickBar.appendChild !== 'function' || typeof document.createElement !== 'function') return;
    const defs = [
      { id: 'chat-bet-btn', text: '🔮 Pari' },
      { id: 'chat-1v1-btn', text: '⚔️ 1v1' },
    ];
    for (const def of defs) {
      if (document.getElementById(def.id)) continue;
      const btn = document.createElement('button');
      if (!btn) continue;
      btn.type = 'button';
      btn.id = def.id;
      btn.className = 'chat-quick-btn';
      btn.textContent = def.text;
      quickBar.appendChild(btn);
    }
  }

  function bindMentionAutocomplete(input) {
    if (!input || input._mentionBound) return;
    input._mentionBound = true;
    const closeSuggest = () => {
      const box = document.getElementById('chat-mention-suggest');
      if (box) box.remove?.();
    };
    input.addEventListener?.('input', () => {
      const val = String(input.value || '');
      const match = /(?:^|\s)@([a-zA-Z0-9_\u00C0-\u024F-]*)$/.exec(val);
      if (!match) { closeSuggest(); return; }
      const q = match[1].toLowerCase();
      const names = Object.values(_profileMap)
        .map(m => m?.username)
        .filter((u, i, arr) => u && arr.indexOf(u) === i && u.toLowerCase().startsWith(q))
        .slice(0, 5);
      if (!names.length || !input.parentElement?.parentElement?.insertBefore) { closeSuggest(); return; }
      let box = document.getElementById('chat-mention-suggest');
      if (!box) {
        box = document.createElement('div');
        if (!box) return;
        box.id = 'chat-mention-suggest';
        box.className = 'chat-mention-suggest';
        box.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-top:6px';
        input.parentElement.parentElement.insertBefore(box, input.parentElement);
      }
      box.innerHTML = names.map(u =>
        `<button type="button" data-mention-pick="${esc(u)}" style="padding:3px 8px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid var(--card-border);background:var(--card-bg);color:var(--text-primary);cursor:pointer">@${esc(u)}</button>`
      ).join('');
      if (!box._bound) {
        box._bound = true;
        box.addEventListener?.('click', e => {
          const btn = e.target?.closest?.('[data-mention-pick]');
          if (!btn) return;
          const picked = btn.dataset.mentionPick;
          input.value = String(input.value || '').replace(/@[a-zA-Z0-9_\u00C0-\u024F-]*$/, `@${picked} `);
          closeSuggest();
          input.focus?.();
        });
      }
    });
  }

  function bindChatControls() {
    ensureQuickButtons();
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
      bindMentionAutocomplete(input);
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
    const betBtn = document.getElementById('chat-bet-btn');
    if (betBtn && !betBtn._chatBound) {
      betBtn._chatBound = true;
      betBtn.addEventListener?.('click', handleQuickBet);
    }
    const c1v1Btn = document.getElementById('chat-1v1-btn');
    if (c1v1Btn && !c1v1Btn._chatBound) {
      c1v1Btn._chatBound = true;
      c1v1Btn.addEventListener?.('click', handleQuick1v1);
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
    _reactionsMap = {};
    _openPickerMsgId = null;

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
    _reactionsMap = {};
    _openPickerMsgId = null;
    clearTimeout(_renderTimer);
    try { _channel?.unsubscribe?.(); } catch {}
    _channel = null;
  }

  async function send() {
    const input = document.getElementById('chat-input');
    const body = input?.value?.trim();
    if (!body || !_groupId) return;
    input.value = '';
    document.getElementById('chat-mention-suggest')?.remove?.();
    input.focus();
    await sendBody(body);
  }

  // ---- Event listeners ----
  document.addEventListener('DOMContentLoaded', bindChatControls);

  return {
    open,
    close,
    send,
    groupId: () => _groupId,
    messageHTML,
    replyToUser,
    ALLOWED_REACTIONS,
    encodeReaction,
    decodeReaction,
    aggregateReactions,
    encodePin,
    decodePin,
    extractLatestPin,
    encodeBet,
    decodeBet,
    encode1v1,
    decode1v1,
    highlightMentions,
  };
})();
