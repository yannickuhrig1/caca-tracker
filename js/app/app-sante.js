// ============================================================
//  app-sante.js
//  duree des seances, carnet de sante (symptomes et contexte),
//  « ce que j'ai remarque » (v2.18.0)
//  Charge apres app-core.js. Les fonctions pures en tete de fichier
//  sont testees (test/sante.test.js).
// ============================================================

// Étiquettes du carnet. `kind` range la saisie en deux groupes ; l'id est ce
// qui part en base (table privée poop_health) : ne jamais le renommer.
const HEALTH_TAGS = [
  // Symptômes
  { id: 'ballonnements', emoji: '🎈', label: 'Ballonnements', kind: 'symptome' },
  { id: 'crampes',       emoji: '🌀', label: 'Maux de ventre', kind: 'symptome' },
  { id: 'incomplet',     emoji: '😣', label: 'Pas vidée',      kind: 'symptome' },
  { id: 'brulure',       emoji: '🔥', label: 'Brûlure',        kind: 'symptome' },
  { id: 'nausee',        emoji: '🤢', label: 'Nausée',         kind: 'symptome' },
  { id: 'glaires',       emoji: '🫧', label: 'Glaires',        kind: 'symptome' },
  { id: 'sang',          emoji: '🩸', label: 'Sang',           kind: 'symptome' },
  // Contexte
  { id: 'regles',        emoji: '🌸', label: 'Règles',         kind: 'contexte' },
  { id: 'stress',        emoji: '😰', label: 'Stress',         kind: 'contexte' },
  { id: 'fatigue',       emoji: '😴', label: 'Mal dormi',      kind: 'contexte' },
  { id: 'sport',         emoji: '🏃‍♀️', label: 'Sport',          kind: 'contexte' },
  { id: 'hydratee',      emoji: '💧', label: 'Bien hydratée',  kind: 'contexte' },
  { id: 'peu-eau',       emoji: '🏜️', label: 'Peu bu',         kind: 'contexte' },
  { id: 'cafe',          emoji: '☕', label: 'Café',           kind: 'contexte' },
  { id: 'epice',         emoji: '🌶️', label: 'Épicé',          kind: 'contexte' },
  { id: 'gras',          emoji: '🍟', label: 'Gras',           kind: 'contexte' },
  { id: 'laitages',      emoji: '🧀', label: 'Laitages',       kind: 'contexte' },
  { id: 'fibres',        emoji: '🥦', label: 'Fruits, légumes', kind: 'contexte' },
  { id: 'medicament',    emoji: '💊', label: 'Médicament',     kind: 'contexte' },
  { id: 'voyage',        emoji: '✈️', label: 'Voyage',         kind: 'contexte' },
];

function healthTagMeta(id) {
  return HEALTH_TAGS.find(t => t.id === id) || null;
}

// ===================================================
//  DURÉE ⏱️
// ===================================================
const DURATION_MAX_S = 3 * 3600;   // même borne que la contrainte SQL
const EXPRESS_S  = 2 * 60;
const MARATHON_S = 15 * 60;

/** Durée exploitable (secondes entières, 1 s à 3 h) ou null. */
function validDuration(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 && n <= DURATION_MAX_S ? n : null;
}

/**
 * « 45 s », « 3 min 12 s », « 1 h 05 min ». Pas de plafond ici : un temps
 * total dépasse vite les 3 h qui bornent une seule séance.
 */
function formatDuration(s) {
  const n = s === null || s === undefined || s === '' ? NaN : Math.round(Number(s));
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n < 60) return `${n} s`;
  if (n < 3600) {
    const m = Math.floor(n / 60), r = n % 60;
    return r ? `${m} min ${String(r).padStart(2, '0')} s` : `${m} min`;
  }
  const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60);
  return `${h} h ${String(m).padStart(2, '0')} min`;
}

/** Fonction pure : bilan des durées mesurées, null si aucune. */
function durationStats(logs) {
  const mesurees = (logs || []).filter(l => validDuration(l.duration) !== null);
  if (!mesurees.length) return null;
  const ds = mesurees.map(l => validDuration(l.duration)).sort((a, b) => a - b);
  const total = ds.reduce((a, b) => a + b, 0);
  const milieu = Math.floor(ds.length / 2);
  const mediane = ds.length % 2 ? ds[milieu] : Math.round((ds[milieu - 1] + ds[milieu]) / 2);
  const record = mesurees.reduce((a, b) => (validDuration(b.duration) > validDuration(a.duration) ? b : a));
  const plusCourt = mesurees.reduce((a, b) => (validDuration(b.duration) < validDuration(a.duration) ? b : a));
  return {
    count:    ds.length,
    total,
    avg:      Math.round(total / ds.length),
    median:   mediane,
    max:      validDuration(record.duration),
    maxDate:  record.date,
    min:      validDuration(plusCourt.duration),
    express:  ds.filter(d => d < EXPRESS_S).length,
    marathon: ds.filter(d => d >= MARATHON_S).length,
  };
}

// ===================================================
//  CE QUE J'AI REMARQUÉ 🔍
// ===================================================
// Pour chaque étiquette notée assez souvent, on compare les selles « avec »
// et « sans » elle. Ce ne sont que des coïncidences sur ses propres données :
// l'écran le dit, et ne parle jamais de cause.
const TEXTURES_MOLLES = new Set(['mou', 'spray', 'liquide', 'explosif']);
const INSIGHT_METRICS = [
  { id: 'molles',  label: 'selles molles ou liquides', test: l => TEXTURES_MOLLES.has(l.texture) },
  { id: 'dures',   label: 'selles dures',              test: l => l.texture === 'dur' },
  { id: 'douleur', label: 'passages douloureux ou difficiles', test: l => l.mood === 'douloureux' || l.mood === 'difficile' },
];

/**
 * Fonction pure. `min` : occurrences minimales avec ET sans l'étiquette.
 * `ecart` : différence minimale (en part, 0..1) pour mériter d'être dite.
 */
function healthInsights(logs, { min = 3, ecart = 0.25 } = {}) {
  const liste = logs || [];
  const part = (sous, test) => sous.filter(test).length / sous.length;
  const out = [];

  HEALTH_TAGS.forEach(tag => {
    const avec = liste.filter(l => Array.isArray(l.health) && l.health.includes(tag.id));
    const sans = liste.filter(l => !(Array.isArray(l.health) && l.health.includes(tag.id)));
    if (avec.length < min || sans.length < min) return;

    let meilleur = null;
    INSIGHT_METRICS.forEach(m => {
      const pa = part(avec, m.test), ps = part(sans, m.test);
      const diff = pa - ps;
      if (Math.abs(diff) >= ecart && (!meilleur || Math.abs(diff) > Math.abs(meilleur.diff))) {
        meilleur = { metric: m.id, metricLabel: m.label, avecPct: Math.round(pa * 100), sansPct: Math.round(ps * 100), diff };
      }
    });
    if (meilleur) out.push({ tag: tag.id, emoji: tag.emoji, label: tag.label, n: avec.length, ...meilleur });
  });

  return out.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
}

/** Fonction pure : étiquettes les plus notées depuis `since`. */
function healthTagCounts(logs, since = 0) {
  const compte = {};
  (logs || []).forEach(l => {
    if (l.date < since || !Array.isArray(l.health)) return;
    l.health.forEach(t => { compte[t] = (compte[t] || 0) + 1; });
  });
  return Object.entries(compte)
    .map(([id, n]) => ({ id, n, meta: healthTagMeta(id) }))
    .filter(r => r.meta)
    .sort((a, b) => b.n - a.n);
}

/**
 * Fonction pure : alerte « sang » si noté au moins deux fois en 14 jours,
 * ou sur la toute dernière entrée. Rend null sinon.
 */
function bloodAlert(logs, now = Date.now()) {
  const tries = [...(logs || [])].sort((a, b) => b.date - a.date);
  const aSang = l => Array.isArray(l.health) && l.health.includes('sang');
  const recents = tries.filter(l => l.date >= now - 14 * 86400000 && aSang(l));
  if (recents.length >= 2) return { count: recents.length, last: tries[0] && aSang(tries[0]) };
  if (tries[0] && aSang(tries[0])) return { count: 1, last: true };
  return null;
}

// ===================================================
//  COMME D'HABITUDE ⚡
// ===================================================
/**
 * Fonction pure : texture, couleur et lieu les plus fréquents parmi les
 * `n` dernières entrées. Le lieu n'est proposé que s'il revient souvent
 * (40 % et au moins 3 fois) : sinon mieux vaut ne rien présumer.
 */
function usualEntry(logs, n = 30) {
  const recents = [...(logs || [])].sort((a, b) => b.date - a.date).slice(0, n);
  if (recents.length < 3) return null;
  const mode = champ => {
    const c = {};
    recents.forEach(l => { if (l[champ]) c[l[champ]] = (c[l[champ]] || 0) + 1; });
    const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
    return top ? { value: top[0], count: top[1] } : null;
  };
  const texture = mode('texture'), color = mode('color'), place = mode('place');
  if (!texture || !color) return null;
  return {
    texture: texture.value,
    color:   color.value,
    place:   place && place.count >= 3 && place.count / recents.length >= 0.4 ? place.value : null,
  };
}

// ===================================================
//  RENDU — tuiles des Stats
// ===================================================
function renderDurationCard() {
  const el = $id('duration-container');
  if (!el) return;
  const st = durationStats(state.logs);
  if (!st) {
    el.innerHTML = `
      <div class="card p-4 rounded-[1.5rem]">
        <div class="font-bold text-sm mb-1">⏱️ Durée des séances</div>
        <div class="text-xs opacity-60">Lance le chrono ⏱️ en haut de l'écran, ou indique la durée à la saisie : tes moyennes et records apparaîtront ici.</div>
      </div>`;
    return;
  }
  const tuiles = [
    { icon: '⏱️', label: 'Moyenne',   value: formatDuration(st.avg) },
    { icon: '📏', label: 'Médiane',   value: formatDuration(st.median) },
    { icon: '🐢', label: 'Record',    value: formatDuration(st.max),
      sub: new Date(st.maxDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) },
    { icon: '⌛', label: 'Temps total', value: formatDuration(st.total) },
  ];
  el.innerHTML = `
    <div class="card p-4 rounded-[1.5rem]">
      <div class="font-bold text-sm mb-1">⏱️ Durée des séances</div>
      <div class="text-xs opacity-60 mb-3">${st.count} séance${st.count > 1 ? 's' : ''} mesurée${st.count > 1 ? 's' : ''}</div>
      <div class="grid grid-cols-2 gap-3">
        ${tuiles.map(t => `
          <div class="rounded-[1rem] p-3 text-center" style="background:color-mix(in srgb,var(--accent) 8%,transparent)">
            <div class="text-xl" aria-hidden="true">${t.icon}</div>
            <div class="text-xs opacity-60">${t.label}</div>
            <div class="font-bold" style="color:var(--accent)">${t.value}</div>
            ${t.sub ? `<div class="text-xs opacity-50">${t.sub}</div>` : ''}
          </div>`).join('')}
      </div>
      <div class="flex justify-center gap-4 text-xs mt-3 opacity-70">
        <span>🏃 ${st.express} express (&lt; 2 min)</span>
        <span>📖 ${st.marathon} marathon (15 min et +)</span>
      </div>
    </div>`;
}

function renderInsightsCard() {
  const el = $id('insights-container');
  if (!el) return;
  const insights = healthInsights(state.logs);
  const top = healthTagCounts(state.logs, Date.now() - 30 * 86400000).slice(0, 6);

  const corps = insights.length
    ? insights.slice(0, 5).map(i => `
        <div class="rounded-[1rem] p-3 mb-2 text-sm" style="background:color-mix(in srgb,var(--accent) 8%,transparent)">
          <div class="font-bold">${i.emoji} ${esc(i.label)}</div>
          <div class="text-xs opacity-80 mt-0.5">
            Les ${i.n} fois où tu l'as noté : <strong>${i.avecPct} %</strong> de ${i.metricLabel},
            contre ${i.sansPct} % le reste du temps.
          </div>
        </div>`).join('')
    : `<div class="text-xs opacity-60 mb-2">
        Rien de marquant pour l'instant. Coche le contexte de tes cacas (section 🩺 à la saisie) :
        dès qu'une étiquette revient 3 fois, je compare avec le reste du temps.
      </div>`;

  el.innerHTML = `
    <div class="card p-4 rounded-[1.5rem]">
      <div class="font-bold text-sm mb-1">🔍 Ce que j'ai remarqué</div>
      <div class="text-xs opacity-60 mb-3">Carnet de santé privé : tes copines ne le voient jamais.</div>
      ${corps}
      ${top.length ? `
        <div class="text-xs font-bold opacity-70 mt-3 mb-1">Le plus noté ces 30 jours</div>
        <div class="flex flex-wrap gap-1">
          ${top.map(t => `<span class="text-xs px-2 py-1 rounded-full" style="background:color-mix(in srgb,var(--accent) 12%,transparent)">${t.meta.emoji} ${esc(t.meta.label)} × ${t.n}</span>`).join('')}
        </div>` : ''}
      <div class="text-[11px] opacity-50 mt-3">Ce sont des coïncidences dans tes données, pas un diagnostic. En cas de doute, parles-en à un médecin.</div>
    </div>`;
}
