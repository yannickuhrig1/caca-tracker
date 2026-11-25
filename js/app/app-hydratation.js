// ============================================================
//  app-hydratation.js
//  Suivi d'hydratation quotidienne (verres d'eau) et check-in
//  « Jour sans passage » pour alimenter les observations 24–48 h.
//  Script classique global (compatible node:vm test/helpers/load.js).
// ============================================================

const WATER_GOAL_DEFAULT = 8;
const WATER_STORAGE_KEY = 'hydratation.v1';
const WATER_MAX = 20;
const ZERO_CHECKIN_KEY = 'checkin0.v1';
const ZERO_CHECKIN_MAX = 90;

let _hydMemStore = {};

function _hydId(id) {
  if (typeof $id === 'function') return $id(id);
  return typeof document !== 'undefined' && typeof document.getElementById === 'function'
    ? document.getElementById(id)
    : null;
}

function _hydEsc(s) {
  if (typeof esc === 'function') return esc(s);
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function _hydReadJSON(key, fallback) {
  try {
    const useLS = typeof LS_OK === 'undefined' ? true : Boolean(LS_OK);
    const raw = useLS && typeof localStorage !== 'undefined'
      ? localStorage.getItem(key)
      : (_hydMemStore[key] ?? null);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function _hydWriteJSON(key, value) {
  const serialized = JSON.stringify(value);
  _hydMemStore[key] = serialized;
  try {
    const useLS = typeof LS_OK === 'undefined' ? true : Boolean(LS_OK);
    if (useLS && typeof localStorage !== 'undefined') {
      localStorage.setItem(key, serialized);
    }
  } catch {}
}

/** Clé de date locale 'YYYY-MM-DD' à partir d'un timestamp ou d'un Date. */
function todayDateKey(now = Date.now()) {
  const d = now instanceof Date ? now : new Date(now);
  const valid = Number.isNaN(d.getTime()) ? new Date() : d;
  const y = valid.getFullYear();
  const m = String(valid.getMonth() + 1).padStart(2, '0');
  const day = String(valid.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function _normalizeWaterMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  if (typeof raw.dateKey === 'string' && raw.count !== undefined) {
    const n = Math.max(0, Math.min(WATER_MAX, Math.floor(Number(raw.count) || 0)));
    return { [raw.dateKey]: n };
  }
  const src = raw.days && typeof raw.days === 'object' && !Array.isArray(raw.days) ? raw.days : raw;
  const out = {};
  Object.entries(src).forEach(([k, v]) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(k)) {
      const n = Math.floor(Number(v));
      if (Number.isFinite(n) && n >= 0) out[k] = Math.min(WATER_MAX, n);
    }
  });
  return out;
}

/** Nombre de verres bus pour la journée `now` (entier >= 0). */
function getWaterToday(now = Date.now()) {
  const map = _normalizeWaterMap(_hydReadJSON(WATER_STORAGE_KEY, {}));
  return map[todayDateKey(now)] || 0;
}

/** Ajoute `delta` verre(s) (borné entre 0 et 20), persiste, met à jour la tuile et renvoie le total. */
function addWaterGlass(delta = 1, now = Date.now()) {
  const map = _normalizeWaterMap(_hydReadJSON(WATER_STORAGE_KEY, {}));
  const key = todayDateKey(now);
  const current = map[key] || 0;
  const step = Number.isFinite(Number(delta)) ? Math.trunc(Number(delta)) : 0;
  const next = Math.min(WATER_MAX, Math.max(0, current + step));
  map[key] = next;

  const pruned = {};
  Object.keys(map).sort().slice(-ZERO_CHECKIN_MAX).forEach(k => {
    pruned[k] = map[k];
  });
  _hydWriteJSON(WATER_STORAGE_KEY, pruned);

  renderHydrationTile(now);
  return next;
}

/**
 * Suggère une étiquette d'hydratation pour la saisie :
 * - 'hydratee' dès 6 verres
 * - 'peu-eau' si <= 1 verre à partir de 18 h
 * - null sinon
 */
function suggestedWaterTag(waterCount, hour = new Date().getHours()) {
  if (waterCount === null || waterCount === undefined || waterCount === '') return null;
  const count = Number(waterCount);
  const h = Number(hour);
  if (!Number.isFinite(count)) return null;
  if (count >= 6) return 'hydratee';
  if (count <= 1 && Number.isFinite(h) && h >= 18) return 'peu-eau';
  return null;
}

// ===================================================
//  CHECK-IN « JOUR SANS PASSAGE » 🌿
// ===================================================
function _normalizeCheckinEntry(item) {
  if (!item || typeof item !== 'object') return null;
  const tsNum = Number(item.ts);
  const hasValidTs = Number.isFinite(tsNum) && tsNum > 0;
  const dateKey = typeof item.dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.dateKey)
    ? item.dateKey
    : (hasValidTs ? todayDateKey(tsNum) : null);
  if (!dateKey) return null;
  const ts = hasValidTs ? tsNum : new Date(dateKey + 'T12:00:00').getTime();
  const tags = [...new Set(
    (Array.isArray(item.tags) ? item.tags : [])
      .map(t => String(t ?? '').trim())
      .filter(Boolean)
  )];
  const note = String(item.note ?? '').trim().slice(0, 280);
  return { dateKey, ts, tags, note };
}

/** Renvoie la liste des check-ins « jour sans passage » (max 90, du plus récent au plus ancien). */
function getZeroPoopCheckins() {
  const raw = _hydReadJSON(ZERO_CHECKIN_KEY, []);
  if (!Array.isArray(raw)) return [];
  const byDate = new Map();
  raw.forEach(item => {
    const norm = _normalizeCheckinEntry(item);
    if (!norm) return;
    const prev = byDate.get(norm.dateKey);
    if (!prev || norm.ts >= prev.ts) byDate.set(norm.dateKey, norm);
  });
  return [...byDate.values()]
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey) || b.ts - a.ts)
    .slice(0, ZERO_CHECKIN_MAX);
}

/** Renvoie le check-in enregistré pour la date de `now`, ou null. */
function getTodayZeroCheckin(now = Date.now()) {
  const key = todayDateKey(now);
  return getZeroPoopCheckins().find(c => c.dateKey === key) || null;
}

/** Enregistre (ou remplace pour le même dateKey) un check-in « jour sans passage ». */
function saveZeroPoopCheckin(tags = [], note = '', now = Date.now()) {
  const tsRaw = now instanceof Date ? now.getTime() : Number(now);
  const ts = Number.isFinite(tsRaw) && tsRaw > 0 ? tsRaw : Date.now();
  const dateKey = todayDateKey(ts);
  const entry = _normalizeCheckinEntry({ dateKey, ts, tags, note });
  const others = getZeroPoopCheckins().filter(c => c.dateKey !== dateKey);
  const updated = [entry, ...others]
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey) || b.ts - a.ts)
    .slice(0, ZERO_CHECKIN_MAX);
  _hydWriteJSON(ZERO_CHECKIN_KEY, updated);

  renderHydrationTile(ts);
  if (typeof renderHealthInsights === 'function') renderHealthInsights();
  return entry;
}

// ===================================================
//  RENDU TUILE & MODALE
// ===================================================
function renderHydrationTile(now = Date.now()) {
  const count = getWaterToday(now);
  const pct = Math.min(100, Math.round((count / WATER_GOAL_DEFAULT) * 100));

  const countEl = _hydId('water-count');
  if (countEl) {
    countEl.textContent = `${count} / ${WATER_GOAL_DEFAULT}`;
  }

  const barEl = _hydId('water-bar');
  if (barEl) {
    if (barEl.style) {
      barEl.style.width = `${pct}%`;
      barEl.style.background = pct >= 100 ? '#10b981' : 'var(--accent)';
    }
    if (typeof barEl.setAttribute === 'function') {
      barEl.setAttribute('aria-valuenow', String(count));
      barEl.setAttribute('aria-valuemax', String(WATER_GOAL_DEFAULT));
    }
  }

  const statusEl = _hydId('zero-checkin-status');
  if (statusEl) {
    const checkin = getTodayZeroCheckin(now);
    if (checkin) {
      const labels = checkin.tags.map(id => {
        const meta = typeof healthTagMeta === 'function' ? healthTagMeta(id) : null;
        return meta ? `${meta.emoji} ${meta.label}` : id;
      });
      const detail = labels.length ? labels.join(', ') : checkin.note;
      statusEl.textContent = detail ? `✅ ${detail}` : '✅ Bilan du jour noté';
    } else {
      const key = todayDateKey(now);
      const hasPoopToday = typeof state !== 'undefined' && Array.isArray(state?.logs)
        && state.logs.some(l => todayDateKey(l.date) === key);
      statusEl.textContent = hasPoopToday
        ? '💩 Passage enregistré aujourd\'hui'
        : 'Jour sans passage ? Note ton ressenti';
    }
  }
}

function openZeroPoopModal(now = Date.now()) {
  if (typeof document === 'undefined' || !document.body || typeof document.createElement !== 'function') return null;

  const prev = _hydId('zero-poop-modal-overlay');
  if (prev && typeof prev.remove === 'function') prev.remove();

  const existing = getTodayZeroCheckin(now);
  const suggested = !existing ? suggestedWaterTag(getWaterToday(now), new Date(now).getHours()) : null;
  const selected = new Set(existing ? existing.tags : (suggested ? [suggested] : []));
  const tagsSource = typeof HEALTH_TAGS !== 'undefined' && Array.isArray(HEALTH_TAGS) ? HEALTH_TAGS : [];

  const renderGroup = (kind, title) => {
    const list = tagsSource.filter(t => t.kind === kind);
    if (!list.length) return '';
    return `
      <div class="mb-3">
        <div class="text-xs font-bold opacity-70 mb-1.5">${_hydEsc(title)}</div>
        <div class="flex flex-wrap gap-1.5">
          ${list.map(t => {
            const on = selected.has(t.id);
            return `<button type="button" class="health-chip${on ? ' on' : ''}" data-zero-tag="${_hydEsc(t.id)}" aria-pressed="${on}">
              <span aria-hidden="true">${t.emoji}</span> ${_hydEsc(t.label)}
            </button>`;
          }).join('')}
        </div>
      </div>`;
  };

  const overlay = document.createElement('div');
  overlay.id = 'zero-poop-modal-overlay';
  overlay.className = 'ui-modal-overlay';
  overlay.innerHTML = `
    <div class="ui-modal" role="dialog" aria-modal="true" aria-labelledby="zero-poop-modal-title">
      <h3 id="zero-poop-modal-title" class="ui-modal-title">🌿 Jour sans passage</h3>
      <div class="ui-modal-body">
        <p class="ui-modal-text text-xs opacity-75 mb-3">
          Rien aujourd'hui ? Note ton contexte ou tes ressentis pour repérer les effets à 24–48 h.
        </p>
        ${renderGroup('contexte', 'Contexte du jour')}
        ${renderGroup('symptome', 'Ressenti digestif')}
        <input type="text" id="zero-poop-note" class="ui-modal-input mt-1"
          value="${_hydEsc(existing?.note || '')}"
          placeholder="Une note ? (repas, voyage, hydratation…)" maxlength="280" />
      </div>
      <div class="ui-modal-actions">
        <button type="button" class="ui-btn ui-btn-ghost" data-act="cancel">Annuler</button>
        <button type="button" class="ui-btn ui-btn-primary" data-act="ok">Enregistrer</button>
      </div>
    </div>`;

  if (typeof document.body.appendChild === 'function') {
    document.body.appendChild(overlay);
  }
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => overlay.classList?.add?.('show'));
  } else {
    overlay.classList?.add?.('show');
  }

  const close = () => {
    overlay.classList?.remove?.('show');
    if (typeof overlay.remove === 'function') {
      setTimeout(() => overlay.remove(), 200);
    }
  };

  if (typeof overlay.querySelectorAll === 'function') {
    overlay.querySelectorAll('[data-zero-tag]').forEach(btn => {
      btn.addEventListener?.('click', () => {
        const id = btn.getAttribute?.('data-zero-tag') || btn.dataset?.zeroTag;
        if (!id) return;
        const nextOn = !selected.has(id);
        if (nextOn) selected.add(id); else selected.delete(id);
        btn.classList?.toggle?.('on', nextOn);
        btn.setAttribute?.('aria-pressed', String(nextOn));
      });
    });
  }

  const okBtn = overlay.querySelector?.('[data-act="ok"]');
  const cancelBtn = overlay.querySelector?.('[data-act="cancel"]');
  const noteInput = overlay.querySelector?.('#zero-poop-note');

  okBtn?.addEventListener?.('click', () => {
    const noteVal = noteInput ? noteInput.value : (existing?.note || '');
    saveZeroPoopCheckin([...selected], noteVal, now);
    close();
    window.UI?.toast?.('Bilan du jour enregistré !', 'success');
  });
  cancelBtn?.addEventListener?.('click', close);
  overlay.addEventListener?.('click', e => { if (e.target === overlay) close(); });

  return overlay;
}
