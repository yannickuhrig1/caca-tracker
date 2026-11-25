// ============================================================
//  🚽 SOCIAL LIVE & TOILETTES ADVISOR (v3.0)
//
//  1. Statut Live « 🚽 Sur le trône » (opt-in strict `social.liveThrone`) :
//     canal Supabase Realtime `throne-live-${groupId}` (Presence + Broadcast
//     d'encouragements instantanés `cheer`).
//  2. Cartes structurées compactes (<= 500 car.) pour `group_messages.body` :
//     - Duel 1v1          : `[duel:<game>:<seed>:<score>:<pseudo>]`
//     - Sondage express   : `[poll:<question>|<optA>|<optB>]`
//     - Toilettes Advisor : `[spot:<name>|<stars>|<pq>|<clean>|<lock>|<note>]`
//  3. Carnet local `advisor.spots.v1`, agrégation multi-avis et panneau Spots.
// ============================================================

const LIVE_THRONE_KEY   = 'social.liveThrone';
const POLL_VOTES_KEY    = 'chat.polls.v1';
const ADVISOR_SPOTS_KEY = 'advisor.spots.v1';
const CHAT_BODY_MAX_LEN = 500;
const LIVE_MAX_AGE_MS   = 2 * 3600 * 1000; // ignore une séance oubliée > 2h

// ---- Helpers internes (sans collision globale) ----

function _liveEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Tronque proprement à `maxLen` unités UTF-16 sans couper une paire surrogate (emoji). */
function _safeTruncate(str, maxLen) {
  const s = String(str ?? '');
  if (maxLen <= 0) return '';
  if (s.length <= maxLen) return s;
  if (maxLen === 1) {
    const code0 = s.charCodeAt(0);
    return (code0 >= 0xD800 && code0 <= 0xDBFF) ? '' : s.slice(0, 1);
  }
  let cut = s.slice(0, maxLen - 1);
  const last = cut.charCodeAt(cut.length - 1);
  if (last >= 0xD800 && last <= 0xDBFF) cut = cut.slice(0, -1);
  return cut.trimEnd() + '…';
}

function _cleanField(str, forbiddenRe) {
  return String(str ?? '')
    .replace(forbiddenRe, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================
//  1. PRÉFÉRENCE OPT-IN « 🚽 SUR LE TRÔNE »
// ============================================================

function isLiveThroneEnabled() {
  try {
    return localStorage.getItem(LIVE_THRONE_KEY) === 'true';
  } catch {
    return false;
  }
}

function setLiveThroneEnabled(v) {
  const enabled = !!v;
  try {
    localStorage.setItem(LIVE_THRONE_KEY, enabled ? 'true' : 'false');
  } catch {}
  if (window.SocialLiveModule) {
    window.SocialLiveModule._onOptInChange?.(enabled);
  }
  return enabled;
}

/**
 * Extrait et dédoublonne les membres présents sur le trône à partir de
 * `channel.presenceState()` Supabase Realtime.
 */
function extractLiveSitters(presenceState, now = Date.now()) {
  if (!presenceState || typeof presenceState !== 'object') return [];
  const byUser = new Map();
  for (const [key, list] of Object.entries(presenceState)) {
    const entries = Array.isArray(list) ? list : [list];
    for (const raw of entries) {
      if (!raw || typeof raw !== 'object') continue;
      const userId = String(raw.userId || raw.user_id || key || '').trim();
      const username = String(raw.username || '').trim();
      if (!userId && !username) continue;
      const startedAt = Number(raw.startedAt) || now;
      if (now - startedAt > LIVE_MAX_AGE_MS) continue;
      const uid = userId || username;
      const prev = byUser.get(uid);
      if (!prev || startedAt >= prev.startedAt) {
        byUser.set(uid, {
          userId: uid,
          username: username || 'Copine',
          avatar: String(raw.avatar || '💩'),
          startedAt,
        });
      }
    }
  }
  return [...byUser.values()].sort((a, b) => a.startedAt - b.startedAt);
}

// ============================================================
//  2. CARTES ENCODÉES CHAT (<= 500 CAR.)
// ============================================================

// ---- Duel 1v1 : [duel:<game>:<seed>:<score>:<pseudo>] ----

function formatDuelMessage(game, seed, score, pseudo) {
  const g = String(game ?? '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!g) return null;
  const rawSeed = String(seed ?? '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const s = rawSeed || '0';
  const sc = Math.max(0, Math.floor(Number(score) || 0));
  const cleanPseudo = _cleanField(pseudo, /[:\[\]\r\n]+/g) || 'Anonyme';

  const prefix = `[duel:${_safeTruncate(g, 32)}:${_safeTruncate(s, 32)}:${sc}:`;
  const maxPseudo = CHAT_BODY_MAX_LEN - prefix.length - 1;
  if (maxPseudo < 1) return null;
  return `${prefix}${_safeTruncate(cleanPseudo, maxPseudo)}]`;
}

function parseDuelMessage(body) {
  const raw = String(body ?? '').trim();
  if (!raw || raw.length > CHAT_BODY_MAX_LEN) return null;
  const m = /^\[duel:([a-z0-9_-]+):([a-zA-Z0-9_-]+):(\d+):([^\[\]:\r\n]+)\]$/.exec(raw);
  if (!m) return null;
  const score = Number(m[3]);
  const pseudo = m[4].trim();
  if (!Number.isFinite(score) || !pseudo) return null;
  return {
    game: m[1],
    seed: m[2],
    score,
    pseudo,
  };
}

// ---- Sondage express : [poll:<question>|<optA>|<optB>] ----

function formatPollMessage(question, optA, optB) {
  const q = _cleanField(question, /[\|\[\]\r\n]+/g);
  const a = _cleanField(optA, /[\|\[\]\r\n]+/g);
  const b = _cleanField(optB, /[\|\[\]\r\n]+/g);
  if (!q || !a || !b) return null;

  // "[poll:" (6) + "|" (1) + "|" (1) + "]" (1) = 9 car. de structure
  const finalA = _safeTruncate(a, 90);
  const finalB = _safeTruncate(b, 90);
  const maxQ = CHAT_BODY_MAX_LEN - 9 - finalA.length - finalB.length;
  const finalQ = _safeTruncate(q, maxQ);
  return `[poll:${finalQ}|${finalA}|${finalB}]`;
}

function parsePollMessage(body) {
  const raw = String(body ?? '').trim();
  if (!raw || raw.length > CHAT_BODY_MAX_LEN) return null;
  const m = /^\[poll:([^\|\[\]\r\n]+)\|([^\|\[\]\r\n]+)\|([^\|\[\]\r\n]+)\]$/.exec(raw);
  if (!m) return null;
  const question = m[1].trim();
  const optA = m[2].trim();
  const optB = m[3].trim();
  if (!question || !optA || !optB) return null;
  return {
    question,
    options: [optA, optB],
  };
}

// ---- Votes locaux des sondages ('chat.polls.v1') ----

function getPollVotes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(POLL_VOTES_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v === 0 || v === 1) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function getPollVote(pollKey) {
  if (!pollKey) return null;
  const votes = getPollVotes();
  const v = votes[String(pollKey)];
  return (v === 0 || v === 1) ? v : null;
}

function votePoll(pollKey, optionIndex) {
  const key = String(pollKey ?? '').trim();
  const idx = Number(optionIndex);
  if (!key || (idx !== 0 && idx !== 1)) return null;
  const votes = getPollVotes();
  votes[key] = idx;
  // Garde les 200 derniers votes au maximum
  const entries = Object.entries(votes);
  const trimmed = entries.length > 200 ? Object.fromEntries(entries.slice(-200)) : votes;
  try {
    localStorage.setItem(POLL_VOTES_KEY, JSON.stringify(trimmed));
  } catch {}
  return idx;
}

// ---- Toilettes Advisor : [spot:<name>|<stars>|<pq>|<clean>|<lock>|<note>] ----

function _clampStars(stars) {
  const n = Math.round(Number(stars));
  if (!Number.isFinite(n)) return 3;
  return Math.min(5, Math.max(1, n));
}

function formatSpotMessage(spot = {}) {
  if (!spot || typeof spot !== 'object') return null;
  const cleanName = _cleanField(spot.name, /[\|\[\]\r\n]+/g);
  if (!cleanName) return null;
  const stars = _clampStars(spot.stars);
  const pq    = spot.pq ? '1' : '0';
  const clean = spot.clean ? '1' : '0';
  const lock  = spot.lock ? '1' : '0';
  const cleanNote = _cleanField(spot.note ?? '', /[\|\[\]\r\n]+/g);

  // "[spot:" (6) + "|" + stars (1) + "|" + pq (1) + "|" + clean (1) + "|" + lock (1) + "|" + "]" = 16 car.
  const finalName = _safeTruncate(cleanName, 120);
  const maxNote = CHAT_BODY_MAX_LEN - 16 - finalName.length;
  const finalNote = cleanNote ? _safeTruncate(cleanNote, maxNote) : '';
  return `[spot:${finalName}|${stars}|${pq}|${clean}|${lock}|${finalNote}]`;
}

function parseSpotMessage(body) {
  const raw = String(body ?? '').trim();
  if (!raw || raw.length > CHAT_BODY_MAX_LEN) return null;
  const m = /^\[spot:([^\|\[\]\r\n]+)\|([1-5])\|([01])\|([01])\|([01])\|([^\|\[\]\r\n]*)\]$/.exec(raw);
  if (!m) return null;
  const name = m[1].trim();
  if (!name) return null;
  return {
    name,
    stars: Number(m[2]),
    pq:    m[3] === '1',
    clean: m[4] === '1',
    lock:  m[5] === '1',
    note:  m[6].trim(),
  };
}

// ============================================================
//  3. CARNET LOCAL & AGRÉGATION TOILETTES ADVISOR
// ============================================================

function getLocalSpots() {
  try {
    const raw = JSON.parse(localStorage.getItem(ADVISOR_SPOTS_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(s => s && typeof s === 'object' && String(s.name ?? '').trim())
      .map(s => ({
        id:        String(s.id || ''),
        name:      _cleanField(s.name, /[\|\[\]\r\n]+/g),
        stars:     _clampStars(s.stars),
        pq:        !!s.pq,
        clean:     !!s.clean,
        lock:      !!s.lock,
        note:      _cleanField(s.note ?? '', /[\|\[\]\r\n]+/g),
        author:    String(s.author || 'Moi').trim() || 'Moi',
        createdAt: Number(s.createdAt) || 0,
      }))
      .filter(s => s.name);
  } catch {
    return [];
  }
}

function saveLocalSpot(spot = {}) {
  if (!spot || typeof spot !== 'object') return null;
  const name = _cleanField(spot.name, /[\|\[\]\r\n]+/g);
  if (!name) return null;
  const createdAt = Number(spot.createdAt) || Date.now();
  const profileName = window.SupabaseClient?.getCurrentProfile?.()?.username;
  const entry = {
    id:        String(spot.id || `spot_${createdAt}_${Math.random().toString(36).slice(2, 7)}`),
    name:      _safeTruncate(name, 120),
    stars:     _clampStars(spot.stars),
    pq:        !!spot.pq,
    clean:     !!spot.clean,
    lock:      !!spot.lock,
    note:      _safeTruncate(_cleanField(spot.note ?? '', /[\|\[\]\r\n]+/g), 320),
    author:    String(spot.author || profileName || 'Moi').trim() || 'Moi',
    createdAt,
  };
  const existing = getLocalSpots().filter(s => s.id !== entry.id);
  const next = [entry, ...existing].slice(0, 200);
  try {
    localStorage.setItem(ADVISOR_SPOTS_KEY, JSON.stringify(next));
  } catch {}
  return entry;
}

function _spotNormKey(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Fusionne et agrège les avis issus des messages du chat (`[spot:...]`) et du
 * carnet local (`advisor.spots.v1`), dédoublonne un avis local déjà posté au
 * chat, puis trie par note moyenne décroissante ⭐.
 */
function aggregateSpots(messages = [], localSpots = []) {
  const reviews = [];
  const seenSignatures = new Set();

  const pushReview = (parsed, author, userKey, ts) => {
    if (!parsed || !parsed.name) return;
    const key = _spotNormKey(parsed.name);
    if (!key) return;
    const cleanAuthor = String(author || 'Membre').trim() || 'Membre';
    const sig = `${key}|${parsed.stars}|${parsed.pq ? 1 : 0}|${parsed.clean ? 1 : 0}|${parsed.lock ? 1 : 0}|${(parsed.note || '').trim().toLowerCase()}|${(userKey || cleanAuthor).toLowerCase()}`;
    if (seenSignatures.has(sig)) return;
    seenSignatures.add(sig);
    reviews.push({
      key,
      name:      parsed.name.trim(),
      stars:     _clampStars(parsed.stars),
      pq:        !!parsed.pq,
      clean:     !!parsed.clean,
      lock:      !!parsed.lock,
      note:      String(parsed.note || '').trim(),
      author:    cleanAuthor,
      createdAt: Number(ts) || 0,
    });
  };

  for (const m of (Array.isArray(messages) ? messages : [])) {
    const body = typeof m === 'string' ? m : m?.body;
    const parsed = parseSpotMessage(body);
    if (!parsed) continue;
    const ts = typeof m === 'object' && m?.created_at ? new Date(m.created_at).getTime() : (Number(m?.createdAt) || 0);
    const author = (typeof m === 'object' && m?.username) ? m.username : 'Membre';
    // Signature par pseudo afin qu'un avis local partagé au chat par la même membre ne compte qu'une fois
    const userKey = (typeof m === 'object' && m?.username && m.username !== '???')
      ? m.username
      : ((typeof m === 'object' && m?.user_id) ? m.user_id : author);
    pushReview(parsed, author, userKey, ts);
  }

  for (const s of (Array.isArray(localSpots) ? localSpots : [])) {
    if (!s || typeof s !== 'object') continue;
    const parsed = {
      name:  _cleanField(s.name, /[\|\[\]\r\n]+/g),
      stars: _clampStars(s.stars),
      pq:    !!s.pq,
      clean: !!s.clean,
      lock:  !!s.lock,
      note:  _cleanField(s.note ?? '', /[\|\[\]\r\n]+/g),
    };
    if (!parsed.name) continue;
    const author = s.author || window.SupabaseClient?.getCurrentProfile?.()?.username || 'Moi';
    pushReview(parsed, author, author, s.createdAt);
  }

  const groups = new Map();
  for (const r of reviews) {
    let g = groups.get(r.key);
    if (!g) {
      g = { key: r.key, name: r.name, items: [] };
      groups.set(r.key, g);
    }
    if (r.createdAt >= (g.items[0]?.createdAt || 0)) g.name = r.name;
    g.items.push(r);
  }

  const out = [];
  for (const g of groups.values()) {
    const items = g.items.slice().sort((a, b) => b.createdAt - a.createdAt);
    const count = items.length;
    const sumStars = items.reduce((acc, x) => acc + x.stars, 0);
    const avgStars = Math.round((sumStars / count) * 10) / 10;
    const pqCount    = items.filter(x => x.pq).length;
    const cleanCount = items.filter(x => x.clean).length;
    const lockCount  = items.filter(x => x.lock).length;
    const latestWithNote = items.find(x => x.note);
    out.push({
      name:      g.name,
      stars:     avgStars,
      avgStars,
      count,
      pq:        pqCount >= count / 2,
      clean:     cleanCount >= count / 2,
      lock:      lockCount >= count / 2,
      pqCount,
      cleanCount,
      lockCount,
      note:      latestWithNote ? latestWithNote.note : '',
      lastNote:  latestWithNote ? latestWithNote.note : '',
      updatedAt: items[0]?.createdAt || 0,
      reviews:   items.map(({ key: _k, ...rest }) => rest),
    });
  }

  return out.sort((a, b) =>
    b.avgStars - a.avgStars ||
    b.count - a.count ||
    b.updatedAt - a.updatedAt ||
    a.name.localeCompare(b.name, 'fr')
  );
}

// ============================================================
//  4. MODALES LÉGÈRES (SPOT ADVISOR & SONDAGE EXPRESS)
// ============================================================

function _closeOverlay(overlay) {
  if (!overlay) return;
  overlay.classList?.remove?.('show');
  setTimeout(() => { try { overlay.remove?.(); } catch {} }, 200);
}

function openAddSpotModal(onCreated) {
  if (!document?.body?.appendChild) return null;
  let selectedStars = 4;
  const state = { pq: true, clean: true, lock: true };

  const overlay = document.createElement('div');
  overlay.className = 'ui-modal-overlay';
  overlay.innerHTML = `
    <div class="ui-modal" role="dialog" aria-modal="true" aria-label="Noter des toilettes">
      <h3 class="ui-modal-title">📍 Noter des toilettes ⭐</h3>
      <div class="ui-modal-body" style="display:grid;gap:10px">
        <input type="text" class="ui-modal-input" data-field="name" maxlength="100"
          placeholder="Nom du lieu (ex : Café de Flore, BU…)" />
        <div style="display:flex;align-items:center;justify-content:center;gap:6px" data-field="stars">
          ${[1, 2, 3, 4, 5].map(n => `
            <button type="button" data-star="${n}" aria-label="${n} étoile${n > 1 ? 's' : ''}"
              style="font-size:24px;line-height:1;padding:4px;border:none;background:none;cursor:pointer;opacity:${n <= selectedStars ? '1' : '0.3'}">⭐</button>
          `).join('')}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center">
          <button type="button" data-flag="pq" class="spot-flag-btn"
            style="padding:6px 12px;border-radius:999px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid var(--accent);background:color-mix(in srgb,var(--accent) 18%,transparent);color:var(--text-primary)">🧻 PQ</button>
          <button type="button" data-flag="clean" class="spot-flag-btn"
            style="padding:6px 12px;border-radius:999px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid var(--accent);background:color-mix(in srgb,var(--accent) 18%,transparent);color:var(--text-primary)">✨ Propre</button>
          <button type="button" data-flag="lock" class="spot-flag-btn"
            style="padding:6px 12px;border-radius:999px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid var(--accent);background:color-mix(in srgb,var(--accent) 18%,transparent);color:var(--text-primary)">🔒 Verrou</button>
        </div>
        <input type="text" class="ui-modal-input" data-field="note" maxlength="220"
          placeholder="Petit avis ou astuce (code, étage, odeur…)" />
      </div>
      <div class="ui-modal-actions">
        <button type="button" class="ui-btn ui-btn-ghost" data-act="cancel">Annuler</button>
        <button type="button" class="ui-btn ui-btn-primary" data-act="ok">Publier ⭐</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => overlay.classList?.add?.('show'));
  } else {
    overlay.classList?.add?.('show');
  }

  const nameInput = overlay.querySelector?.('[data-field="name"]');
  const noteInput = overlay.querySelector?.('[data-field="note"]');

  const refreshStars = () => {
    overlay.querySelectorAll?.('[data-star]')?.forEach(btn => {
      const n = Number(btn.dataset.star);
      btn.style.opacity = n <= selectedStars ? '1' : '0.3';
    });
  };

  overlay.querySelectorAll?.('[data-star]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedStars = _clampStars(btn.dataset.star);
      refreshStars();
    });
  });

  overlay.querySelectorAll?.('[data-flag]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const f = btn.dataset.flag;
      state[f] = !state[f];
      btn.style.borderColor = state[f] ? 'var(--accent)' : 'var(--card-border)';
      btn.style.background = state[f] ? 'color-mix(in srgb,var(--accent) 18%,transparent)' : 'transparent';
      btn.style.opacity = state[f] ? '1' : '0.55';
    });
  });

  const submit = () => {
    const name = String(nameInput?.value || '').trim();
    if (!name) {
      window.UI?.toast?.('Indique le nom des toilettes 📍', 'error');
      nameInput?.focus?.();
      return;
    }
    const rawSpot = {
      name,
      stars: selectedStars,
      pq:    state.pq,
      clean: state.clean,
      lock:  state.lock,
      note:  String(noteInput?.value || '').trim(),
    };
    const saved = saveLocalSpot(rawSpot);
    const encoded = formatSpotMessage(rawSpot);
    _closeOverlay(overlay);
    window.UI?.toast?.('Avis ajouté dans Toilettes Advisor ⭐', 'success');
    if (typeof onCreated === 'function') onCreated(saved, encoded);
  };

  overlay.querySelector?.('[data-act="ok"]')?.addEventListener('click', submit);
  overlay.querySelector?.('[data-act="cancel"]')?.addEventListener('click', () => _closeOverlay(overlay));
  overlay.addEventListener?.('click', e => { if (e.target === overlay) _closeOverlay(overlay); });
  setTimeout(() => nameInput?.focus?.(), 60);
  return overlay;
}

function openCreatePollModal(onCreated) {
  if (!document?.body?.appendChild) return null;
  const overlay = document.createElement('div');
  overlay.className = 'ui-modal-overlay';
  overlay.innerHTML = `
    <div class="ui-modal" role="dialog" aria-modal="true" aria-label="Nouveau sondage express">
      <h3 class="ui-modal-title">📊 Sondage express</h3>
      <div class="ui-modal-body" style="display:grid;gap:8px">
        <input type="text" class="ui-modal-input" data-field="q" maxlength="200"
          placeholder="Question (ex : Team PQ plié ou froissé ?)" />
        <input type="text" class="ui-modal-input" data-field="a" maxlength="80"
          placeholder="Option A (ex : Plié 📐)" />
        <input type="text" class="ui-modal-input" data-field="b" maxlength="80"
          placeholder="Option B (ex : Froissé 🌪️)" />
      </div>
      <div class="ui-modal-actions">
        <button type="button" class="ui-btn ui-btn-ghost" data-act="cancel">Annuler</button>
        <button type="button" class="ui-btn ui-btn-primary" data-act="ok">Lancer 📊</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => overlay.classList?.add?.('show'));
  } else {
    overlay.classList?.add?.('show');
  }

  const qInput = overlay.querySelector?.('[data-field="q"]');
  const aInput = overlay.querySelector?.('[data-field="a"]');
  const bInput = overlay.querySelector?.('[data-field="b"]');

  const submit = () => {
    const encoded = formatPollMessage(qInput?.value, aInput?.value, bInput?.value);
    if (!encoded) {
      window.UI?.toast?.('Remplis la question et les 2 options 📊', 'error');
      return;
    }
    _closeOverlay(overlay);
    if (typeof onCreated === 'function') onCreated(encoded);
  };

  overlay.querySelector?.('[data-act="ok"]')?.addEventListener('click', submit);
  overlay.querySelector?.('[data-act="cancel"]')?.addEventListener('click', () => _closeOverlay(overlay));
  overlay.addEventListener?.('click', e => { if (e.target === overlay) _closeOverlay(overlay); });
  setTimeout(() => qInput?.focus?.(), 60);
  return overlay;
}

// ============================================================
//  5. PANNEAU « TOILETTES ADVISOR » (#social-pane-spots)
// ============================================================

function _starsVisual(stars) {
  const full = Math.min(5, Math.max(1, Math.round(Number(stars) || 1)));
  return '⭐'.repeat(full) + '☆'.repeat(5 - full);
}

async function renderSpotsPane(containerId = 'social-pane-spots') {
  const el = document.getElementById(containerId);
  if (!el) return [];

  const groupId = window.SocialLiveModule?.currentGroupId?.()
    || window.SocialModule?.currentGroupId?.()
    || window.ChatModule?.groupId?.()
    || null;

  let messages = [];
  if (groupId && window.SupabaseClient?.groupChatAvailable?.()) {
    try {
      messages = await window.SupabaseClient.getGroupMessages(groupId, 100);
    } catch {
      messages = [];
    }
  }

  const spots = aggregateSpots(messages, getLocalSpots());

  const listHTML = spots.length
    ? spots.map(s => `
        <div class="spot-advisor-card p-4 rounded-[1.25rem]"
          style="background:color-mix(in srgb,var(--accent) 8%,var(--card-bg));border:1px solid var(--card-border)">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
            <div style="font-weight:800;font-size:15px;color:var(--text-primary)">📍 ${_liveEsc(s.name)}</div>
            <div style="font-size:12px;font-weight:800;white-space:nowrap;color:var(--accent)" title="${_liveEsc(s.avgStars)} / 5">
              ${_starsVisual(s.avgStars)} <span>${_liveEsc(s.avgStars)}</span>
              ${s.count > 1 ? `<span style="opacity:.65;font-weight:600">(${s.count})</span>` : ''}
            </div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;font-size:11px;font-weight:700">
            <span style="padding:2px 8px;border-radius:999px;background:color-mix(in srgb,${s.pq ? '#10b981' : '#ef4444'} 16%,transparent);color:var(--text-primary)">
              ${s.pq ? '🧻 PQ' : '🚫 Sans PQ'}
            </span>
            <span style="padding:2px 8px;border-radius:999px;background:color-mix(in srgb,${s.clean ? '#10b981' : '#f59e0b'} 16%,transparent);color:var(--text-primary)">
              ${s.clean ? '✨ Propre' : '⚠️ Moyen'}
            </span>
            <span style="padding:2px 8px;border-radius:999px;background:color-mix(in srgb,${s.lock ? '#10b981' : '#f59e0b'} 16%,transparent);color:var(--text-primary)">
              ${s.lock ? '🔒 Verrou' : '🚪 Sans verrou'}
            </span>
          </div>
          ${s.lastNote ? `<p style="margin-top:8px;font-size:12px;opacity:.85;color:var(--text-primary)">« ${_liveEsc(s.lastNote)} »</p>` : ''}
        </div>`).join('')
    : `<div class="text-center text-sm opacity-60 py-6">Aucun trône noté pour l'instant — inaugure le guide ! 🚽⭐</div>`;

  el.innerHTML = `
    <div class="card p-5 rounded-[2rem] shadow space-y-3">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div>
          <h4 class="font-bold">📍 Toilettes Advisor</h4>
          <p class="text-xs opacity-60">Les meilleurs (et pires) coins testés par le groupe</p>
        </div>
        <button type="button" data-act="add-advisor-spot"
          class="px-3 py-2 rounded-full text-xs font-bold text-white"
          style="background:linear-gradient(135deg,var(--header-from),var(--header-to));border:none;cursor:pointer">
          + Noter des toilettes ⭐
        </button>
      </div>
      <div class="space-y-2" data-role="spots-list">${listHTML}</div>
    </div>`;

  el.querySelector?.('[data-act="add-advisor-spot"]')?.addEventListener('click', () => {
    openAddSpotModal(async (_saved, encoded) => {
      const gid = window.SocialLiveModule?.currentGroupId?.()
        || window.SocialModule?.currentGroupId?.()
        || window.ChatModule?.groupId?.();
      if (gid && encoded && window.SupabaseClient?.isLoggedIn?.() && window.SupabaseClient?.groupChatAvailable?.()) {
        try {
          await window.SupabaseClient.sendGroupMessage(gid, encoded);
        } catch {}
      }
      renderSpotsPane(containerId);
    });
  });

  return spots;
}

// ============================================================
//  6. MODULE TEMPS RÉEL « SUR LE TRÔNE » (Presence + Broadcast)
// ============================================================

window.SocialLiveModule = (() => {
  let _groupId      = null;
  let _channel      = null;
  let _subscribed   = false;
  let _timerStartTs = null;
  let _sitters      = [];
  let _lastCheerAt  = {};

  function _myProfile() {
    return window.SupabaseClient?.getCurrentProfile?.() || null;
  }

  function _presencePayload() {
    const prof = _myProfile();
    return {
      userId:    prof?.id || 'me',
      username:  prof?.username || 'Moi',
      avatar:    prof?.avatar || '💩',
      startedAt: _timerStartTs || Date.now(),
    };
  }

  function _syncSittersFromChannel() {
    let remote = [];
    try {
      const state = _channel?.presenceState?.();
      remote = extractLiveSitters(state);
    } catch {
      remote = [];
    }
    // Présence locale immédiate si le chrono tourne avec l'opt-in actif
    if (_groupId && _timerStartTs && isLiveThroneEnabled()) {
      const mine = _presencePayload();
      if (!remote.some(s => s.userId === mine.userId)) {
        remote.push(mine);
      }
    }
    _sitters = remote;
    return _sitters;
  }

  function _trackNow() {
    if (!_channel || !_timerStartTs || !isLiveThroneEnabled()) return;
    try {
      Promise.resolve(_channel.track?.(_presencePayload())).catch(() => {});
    } catch {}
  }

  function _untrackNow() {
    if (!_channel) return;
    try {
      Promise.resolve(_channel.untrack?.()).catch(() => {});
    } catch {}
  }

  function _onCheerBroadcast(msg) {
    const data = msg?.payload || msg || {};
    const myId = _myProfile()?.id;
    if (!data) return;
    // Le toast ne s'affiche que chez la destinataire ciblée (ou pour les autres si non ciblé)
    if (data.targetUserId) {
      if (!myId || data.targetUserId !== myId) return;
    } else if (myId && data.fromUserId === myId) {
      return;
    }
    const sender = String(data.fromName || 'Une copine').trim();
    const emoji = String(data.emoji || '🧻').trim();
    window.UI?.toast?.(`${emoji} ${sender} t'encourage sur le trône !`, 'party');
  }

  function renderLiveBanner() {
    const el = document.getElementById('social-live-throne');
    _syncSittersFromChannel();
    if (!el) return _sitters;

    if (!_groupId || !_sitters.length) {
      el.innerHTML = '';
      el.classList?.add?.('hidden');
      return _sitters;
    }

    const myId = _myProfile()?.id || 'me';
    const rows = _sitters.map(s => {
      const mins = Math.max(0, Math.floor((Date.now() - s.startedAt) / 60000));
      const durTxt = mins < 1 ? 'à l\'instant' : `${mins} min`;
      const isMe = s.userId === myId;
      return `
        <div class="live-throne-row" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0">
          <div style="display:flex;align-items:center;gap:8px;min-width:0">
            <span class="live-throne-dot" aria-hidden="true"
              style="width:9px;height:9px;border-radius:999px;background:#10b981;display:inline-block;flex-shrink:0"></span>
            <span style="font-size:18px;flex-shrink:0">${_liveEsc(s.avatar || '💩')}</span>
            <span style="font-size:13px;font-weight:700;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              ${isMe ? '🚽 Tu es en direct sur le trône' : `🚽 ${_liveEsc(s.username)} est sur le trône`}
              <span style="font-weight:500;opacity:.65;font-size:11px">· ${durTxt}</span>
            </span>
          </div>
          ${isMe ? '' : `
            <button type="button" data-cheer-uid="${_liveEsc(s.userId)}" data-cheer-name="${_liveEsc(s.username)}"
              style="flex-shrink:0;padding:5px 10px;border-radius:999px;border:none;cursor:pointer;font-size:11px;font-weight:800;background:var(--accent);color:#fff">
              🧻 Encourager
            </button>`}
        </div>`;
    }).join('');

    el.classList?.remove?.('hidden');
    el.innerHTML = `
      <div class="live-throne-banner p-3 rounded-[1.25rem]"
        style="background:color-mix(in srgb,#10b981 12%,var(--card-bg));border:1.5px solid color-mix(in srgb,#10b981 35%,var(--card-border))">
        ${rows}
      </div>`;

    el.querySelectorAll?.('[data-cheer-uid]')?.forEach(btn => {
      btn.addEventListener('click', () => {
        sendCheer(btn.dataset.cheerUid, btn.dataset.cheerName);
      });
    });

    return _sitters;
  }

  function disconnect() {
    const sb = window.SupabaseClient?.getClient?.();
    if (_channel) {
      _untrackNow();
      try { _channel.unsubscribe?.(); } catch {}
      try { sb?.removeChannel?.(_channel); } catch {}
    }
    _channel    = null;
    _subscribed = false;
    _groupId    = null;
    _sitters    = [];
    renderLiveBanner();
  }

  function connectGroup(groupId) {
    if (!groupId) {
      disconnect();
      return null;
    }
    if (_groupId === groupId && _channel) {
      renderLiveBanner();
      return _channel;
    }
    if (_channel) {
      const sbPrev = window.SupabaseClient?.getClient?.();
      _untrackNow();
      try { _channel.unsubscribe?.(); } catch {}
      try { sbPrev?.removeChannel?.(_channel); } catch {}
      _channel = null;
      _subscribed = false;
    }

    _groupId = groupId;
    _sitters = [];

    const sb = window.SupabaseClient?.getClient?.();
    if (!sb || typeof sb.channel !== 'function') {
      renderLiveBanner();
      return null;
    }

    const prof = _myProfile();
    const opts = prof?.id ? { config: { presence: { key: prof.id } } } : undefined;
    const ch = opts ? sb.channel(`throne-live-${groupId}`, opts) : sb.channel(`throne-live-${groupId}`);

    if (ch && typeof ch.on === 'function') {
      ch.on('presence', { event: 'sync' }, () => renderLiveBanner());
      ch.on('presence', { event: 'join' }, () => renderLiveBanner());
      ch.on('presence', { event: 'leave' }, () => renderLiveBanner());
      ch.on('broadcast', { event: 'cheer' }, payload => _onCheerBroadcast(payload));
    }

    _channel = ch;

    if (ch && typeof ch.subscribe === 'function') {
      ch.subscribe(status => {
        if (status === 'SUBSCRIBED') {
          _subscribed = true;
          if (_timerStartTs && isLiveThroneEnabled()) _trackNow();
          renderLiveBanner();
        }
      });
    }

    renderLiveBanner();
    return _channel;
  }

  function onTimerStart(startedAt = Date.now()) {
    _timerStartTs = Number(startedAt) || Date.now();
    if (isLiveThroneEnabled() && _channel) {
      _trackNow();
    }
    renderLiveBanner();
  }

  function onTimerStop() {
    _timerStartTs = null;
    _untrackNow();
    renderLiveBanner();
  }

  async function sendCheer(targetUserId, targetName = 'ta copine') {
    if (!_channel || typeof _channel.send !== 'function') return false;
    const now = Date.now();
    const key = String(targetUserId || targetName);
    if (_lastCheerAt[key] && now - _lastCheerAt[key] < 2000) return false;
    _lastCheerAt[key] = now;

    const prof = _myProfile();
    const cheers = ['🧻', '💪', '👑', '🔥', '🎉'];
    const emoji = cheers[Math.floor(Math.random() * cheers.length)];
    const payload = {
      targetUserId: targetUserId || null,
      targetName:   targetName || 'Copine',
      fromUserId:   prof?.id || null,
      fromName:     prof?.username || 'Une copine',
      fromAvatar:   prof?.avatar || '💩',
      emoji,
      ts:           now,
    };

    try {
      await _channel.send({ type: 'broadcast', event: 'cheer', payload });
      window.UI?.toast?.(`Encouragement envoyé à ${targetName} ${emoji}`, 'success');
      return true;
    } catch {
      return false;
    }
  }

  function applyLiveThroneToggle() {
    const on = isLiveThroneEnabled();
    const btn = document.getElementById('live-throne-toggle');
    const knob = document.getElementById('live-throne-knob');
    if (btn) {
      btn.setAttribute?.('aria-checked', on ? 'true' : 'false');
      btn.classList?.toggle?.('is-on', on);
      btn.style.background = on ? 'var(--accent)' : 'rgba(0,0,0,0.15)';
    }
    if (knob) {
      knob.style.transform = on ? 'translateX(20px)' : 'translateX(0)';
    }
  }

  function toggleLiveThrone() {
    const next = !isLiveThroneEnabled();
    setLiveThroneEnabled(next);
    applyLiveThroneToggle();
    window.UI?.toast?.(
      next
        ? 'Statut live « 🚽 Sur le trône » activé pendant ton chrono !'
        : 'Statut live « 🚽 Sur le trône » désactivé',
      'info'
    );
    return next;
  }

  function _onOptInChange(enabled) {
    if (!enabled) {
      _untrackNow();
    } else {
      // Si le chrono global tourne déjà (ex. activé en pleine séance)
      if (!_timerStartTs && typeof window.isTimerRunning === 'function' && window.isTimerRunning()) {
        _timerStartTs = Date.now();
      }
      if (_timerStartTs && _channel) _trackNow();
    }
    applyLiveThroneToggle();
    renderLiveBanner();
  }

  document.addEventListener('DOMContentLoaded', () => {
    applyLiveThroneToggle();
  });

  return {
    // Live Throne
    isLiveThroneEnabled,
    setLiveThroneEnabled,
    toggleLiveThrone,
    applyLiveThroneToggle,
    extractLiveSitters,
    connectGroup,
    disconnect,
    onTimerStart,
    onTimerStop,
    sendCheer,
    renderLiveBanner,
    currentGroupId: () => _groupId,
    getLiveSitters: () => _sitters.slice(),
    _onOptInChange,
    // Duels 1v1
    formatDuelMessage,
    parseDuelMessage,
    // Sondages express
    formatPollMessage,
    parsePollMessage,
    getPollVotes,
    getPollVote,
    votePoll,
    openCreatePollModal,
    // Toilettes Advisor
    formatSpotMessage,
    parseSpotMessage,
    saveLocalSpot,
    getLocalSpots,
    aggregateSpots,
    openAddSpotModal,
    renderSpotsPane,
  };
})();
