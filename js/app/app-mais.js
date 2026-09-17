// ============================================================
//  app-mais.js
//  Test du maïs 🌽 (v2.20.0) : le vrai examen de transit, celui que
//  font les médecins. On note l'heure où le maïs est mangé, puis la
//  saisie du caca où on le revoit donne le temps de transit réel.
//  Différent de la tuile « Transit intestinal moyen » des Stats, qui
//  mesure seulement l'intervalle entre deux cacas.
//  Charge apres app-sante.js et avant app-saisie.js.
//  Fonctions pures testées : test/mais.test.js
// ============================================================

const MAIS_KEY = 'mais.tests.v1';
const MAIS_EXPIRE_H = 5 * 24;     // un test oublié depuis 5 jours s'arrête
const MAIS_MIN_H = 6;             // revu en moins de 6 h : c'est un maïs d'avant
const MAIS_MAX_RESULTATS = 10;

/** Relit le stockage en se méfiant de tout : rend { pending, results }. */
function maisNormalize(raw) {
  const base = { pending: null, results: [] };
  if (!raw || typeof raw !== 'object') return base;
  const ts = v => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
  const pending = ts(raw.pending?.ateAt);
  return {
    pending: pending ? { ateAt: pending } : null,
    results: (Array.isArray(raw.results) ? raw.results : [])
      .map(r => ({ ateAt: ts(r?.ateAt), foundAt: ts(r?.foundAt) }))
      .filter(r => r.ateAt && r.foundAt && r.foundAt > r.ateAt)
      .sort((a, b) => b.foundAt - a.foundAt)
      .slice(0, MAIS_MAX_RESULTATS),
  };
}

const maisHeures = (debut, fin) => (fin - debut) / 3600000;

/** Test en cours à l'instant `now`, ou null (jamais lancé, ou trop vieux). */
function maisPending(data, now = Date.now()) {
  const d = maisNormalize(data);
  if (!d.pending) return null;
  const h = maisHeures(d.pending.ateAt, now);
  if (h < 0 || h > MAIS_EXPIRE_H) return null;
  return { ateAt: d.pending.ateAt, hours: h };
}

/** Démarre (ou remplace) un test. */
function maisStart(data, ateAt = Date.now()) {
  const d = maisNormalize(data);
  return { ...d, pending: { ateAt } };
}

function maisCancel(data) {
  return { ...maisNormalize(data), pending: null };
}

/**
 * Le maïs est revu dans le caca daté `foundAt`.
 * Rend { ok, data, hours, reason } ; reason vaut 'aucun' (pas de test en
 * cours) ou 'tot' (moins de 6 h : ce maïs vient d'un repas précédent).
 */
function maisFound(data, foundAt = Date.now(), now = Date.now()) {
  const d = maisNormalize(data);
  const encours = maisPending(d, now);
  if (!encours) return { ok: false, data: d, hours: null, reason: 'aucun' };
  const hours = maisHeures(encours.ateAt, foundAt);
  if (hours < MAIS_MIN_H) return { ok: false, data: d, hours, reason: 'tot' };
  return {
    ok: true,
    hours,
    data: {
      pending: null,
      results: [{ ateAt: encours.ateAt, foundAt }, ...d.results].slice(0, MAIS_MAX_RESULTATS),
    },
  };
}

/**
 * Lecture d'un temps de transit. Les repères courants : au-delà de 3 jours
 * on parle de transit lent, en dessous d'une dizaine d'heures de transit
 * rapide. Ce n'est pas un diagnostic.
 */
function transitVerdict(hours) {
  if (!Number.isFinite(hours)) return null;
  if (hours < 12) return { niveau: 'rapide', emoji: '⚡', texte: 'Transit rapide : moins de 12 h. Si ça se répète avec des selles liquides, parles-en.' };
  if (hours <= 72) return { niveau: 'normal', emoji: '✅', texte: 'Dans la norme : la plupart des transits durent entre 12 h et 3 jours.' };
  return { niveau: 'lent', emoji: '🐌', texte: 'Transit lent : plus de 3 jours. Fibres, eau et un peu de marche aident souvent.' };
}

/** Résumé prêt à afficher : { pending, dernier, moyenne }. */
function maisSummary(data, now = Date.now()) {
  const d = maisNormalize(data);
  const dernier = d.results[0] || null;
  const moyenne = d.results.length
    ? d.results.reduce((a, r) => a + maisHeures(r.ateAt, r.foundAt), 0) / d.results.length
    : null;
  return {
    pending: maisPending(d, now),
    dernier: dernier ? { ...dernier, hours: maisHeures(dernier.ateAt, dernier.foundAt) } : null,
    moyenne,
    total: d.results.length,
  };
}

function maisFormat(hours) {
  if (!Number.isFinite(hours)) return '—';
  if (hours < 48) return `${Math.round(hours)} h`;
  const j = Math.floor(hours / 24);
  const h = Math.round(hours - j * 24);
  return h ? `${j} j ${h} h` : `${j} j`;
}

// ===================================================
//  STOCKAGE
// ===================================================
function maisLoad() {
  try { return maisNormalize(JSON.parse(localStorage.getItem(MAIS_KEY) || 'null')); }
  catch { return maisNormalize(null); }
}

function maisSave(data) {
  try { localStorage.setItem(MAIS_KEY, JSON.stringify(maisNormalize(data))); } catch {}
}

/** Heures écoulées du test en cours, arrondies, ou null (pour l'écran des jeux). */
function maisPendingHours() {
  const p = maisPending(maisLoad());
  return p ? Math.round(p.hours) : null;
}

// ===================================================
//  CARTE DANS LES STATS
// ===================================================
function renderMaisCard() {
  const el = $id('mais-card');
  if (!el) return;
  const r = maisSummary(maisLoad());
  const v = r.dernier ? transitVerdict(r.dernier.hours) : null;
  const historique = r.total > 1 ? `<div class="text-xs opacity-60 mt-1">${r.total} tests · moyenne ${esc(maisFormat(r.moyenne))}</div>` : '';

  if (r.pending) {
    el.innerHTML = `
      <div class="mais-run">
        <div class="text-sm font-bold">🌽 Test en cours depuis ${esc(maisFormat(r.pending.hours))}</div>
        <p class="text-xs opacity-70 mt-1">Au prochain caca, coche « Je vois du maïs » dans la saisie. Sans nouvelle après 5 jours, le test s'arrête.</p>
        <button type="button" id="mais-cancel" class="mais-btn ghost mt-2">Annuler le test</button>
      </div>${historique}`;
  } else {
    el.innerHTML = `
      ${r.dernier ? `
        <div class="mais-result">
          <div class="mais-hours">${esc(maisFormat(r.dernier.hours))}</div>
          <div class="text-xs opacity-70">dernier transit mesuré, le ${new Date(r.dernier.foundAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</div>
          ${v ? `<div class="mais-verdict mt-2">${v.emoji} ${esc(v.texte)}</div>` : ''}
        </div>${historique}`
        : '<p class="text-xs opacity-70">Le vrai test : mange du maïs, note-le ici, puis coche « Je vois du maïs » au caca où tu le retrouves. L\'app calcule ton temps de transit réel.</p>'}
      <button type="button" id="mais-start" class="mais-btn mt-3">🌽 J'ai mangé du maïs</button>`;
  }

  $id('mais-start')?.addEventListener('click', demarrerTestMais);
  $id('mais-cancel')?.addEventListener('click', async () => {
    if (!(await window.UI.confirm('Annuler le test du maïs en cours ?', { okLabel: 'Annuler le test' }))) return;
    maisSave(maisCancel(maisLoad()));
    renderMaisCard();
  });
}

async function demarrerTestMais() {
  const choix = await window.UI.choose({
    title: '🌽 Test du maïs',
    message: 'Quand as-tu mangé le maïs ? Le compte part de ce moment-là.',
    options: [
      { value: '0', label: 'À l\'instant' },
      { value: '2', label: 'Il y a 2 heures' },
      { value: '6', label: 'Il y a 6 heures' },
      { value: '12', label: 'Il y a 12 heures' },
    ],
  });
  if (choix === null || choix === undefined) return;
  maisSave(maisStart(maisLoad(), Date.now() - Number(choix) * 3600000));
  renderMaisCard();
  refreshMaisRow();
  window.UI.toast('Test lancé ! Coche « Je vois du maïs » au caca où tu le retrouves.', 'success', 5000);
}

// ===================================================
//  CASE DANS LA SAISIE
// ===================================================
function refreshMaisRow() {
  const row = $id('mais-row');
  if (!row) return;
  const p = maisPending(maisLoad());
  // Seulement en création : cocher une vieille entrée fausserait la mesure.
  const visible = !!p && editingId === null;
  row.classList.toggle('hidden', !visible);
  const info = $id('mais-row-info');
  if (info && p) info.textContent = `test lancé il y a ${maisFormat(p.hours)}`;
  if (!visible) { const c = $id('mais-chk'); if (c) c.checked = false; }
}

/** Appelée après l'enregistrement d'un caca : conclut le test si la case est cochée. */
function maisOnPoopSaved(poop) {
  const chk = $id('mais-chk');
  if (!chk?.checked) return;
  chk.checked = false;
  const r = maisFound(maisLoad(), poop.date);
  if (!r.ok) {
    if (r.reason === 'tot') {
      window.UI.toast(`Seulement ${maisFormat(r.hours)} après le repas : ce maïs vient d'avant, le test continue.`, 'info', 6000);
    }
    return;
  }
  maisSave(r.data);
  const v = transitVerdict(r.hours);
  window.UI.toast(`🌽 Transit mesuré : ${maisFormat(r.hours)}. ${v ? v.texte : ''}`, 'party', 7000);
  renderMaisCard();
  if (typeof updateBadges === 'function') updateBadges();
}

/** État du badge « Test du maïs » (au moins un transit mesuré). */
function maisBadgeState() {
  const n = maisLoad().results.length;
  return { pct: n >= 1 ? 100 : 0, done: n >= 1 };
}

function setupMais() {
  renderMaisCard();
  refreshMaisRow();
}
