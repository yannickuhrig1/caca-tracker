// ============================================================
//  app-render.js
//  rendu du dashboard, historique, stats, streak
//  Extrait du bloc <script> de index.html. L'ordre de chargement
//  est significatif : ces fichiers partagent la portee globale.
// ============================================================

// ===================================================
//  RENDER ALL
// ===================================================
function renderAll() {
  renderDashboard();
  renderHistory();
  updateStreakBadge();
  updateBadges();
}

// ===================================================
//  DASHBOARD
// ===================================================
function renderDashboard() {
  // Carte « Aujourd'hui » et mascotte (v2.18.0, app-accueil.js)
  if (typeof renderHomeCard === 'function') renderHomeCard();
  const today = new Date().toDateString();
  const todayCount = state.logs.filter(l => new Date(l.date).toDateString() === today).length;
  $id('today-count').textContent = todayCount;
  $id('total-count').textContent = state.logs.length;
  $id('mass').textContent = (state.logs.length * 0.15).toFixed(1) + ' kg';
  updateChart();
  updateGoalUI(parseInt(localStorage.getItem('dailyGoal') || '1'));

  // Tendances de santé (feature 10)
  checkHealthTrends();

  // Rappel intelligent
  renderSmartReminder();

  // Défi streak
  renderStreakChallenge();

  // Résumé semaine
  renderWeekSummary();

  // Anniversaires
  const anniv = checkAnniversaries();
  const annivEl = $id('anniversary-banner');
  if (annivEl) {
    if (anniv) {
      annivEl.innerHTML = `<div class="text-3xl mb-1">${anniv.emoji}</div>
        <div class="font-bold">Anniversaire !</div>
        <div class="text-sm mt-1 opacity-90">Il y a exactement ${anniv.yearsAgo} an${anniv.yearsAgo > 1 ? 's' : ''}, c'était ton <strong>${anniv.label}</strong> ! 🎂</div>`;
      annivEl.classList.remove('hidden');
    } else {
      annivEl.classList.add('hidden');
    }
  }

  // Blague du jour
  window.JokesModule?.displayDailyJoke();

  // Prédiction
  const predEl = $id('prediction-text');
  if (predEl && typeof PredictionEngine !== 'undefined') {
    if (state.logs.length >= 2) {
      try {
        const pred = new PredictionEngine(state.logs).predictNextPoop();
        predEl.textContent = (pred.icon || '🔮') + ' ' + pred.message;
      } catch(e) { predEl.textContent = '🔮 Prédiction indisponible'; }
    } else {
      predEl.textContent = '🔮 Ajoute au moins 2 cacas pour une prédiction…';
    }
  }
}

// ===================================================
//  HISTORY
// ===================================================
// L'historique s'arrêtait aux 20 dernières entrées, sans moyen de remonter
// plus loin. Il est maintenant filtrable et se déplie par tranches de 20.
const HISTORY_PAGE = 20;
let historyShown = HISTORY_PAGE;
let historyFilters = { q: '', texture: '', color: '', place: '', period: 'all' };

// Un filtre actif change l'écran : on le dit, et on propose de l'annuler.
function historyFiltersActive(f = historyFilters) {
  return !!(f.q.trim() || f.texture || f.color || f.place || (f.period && f.period !== 'all'));
}

// Fonction pure : c'est elle qui décide de ce qui s'affiche, elle est testée.
function filterLogs(logs, f = historyFilters, now = Date.now()) {
  const q = (f.q || '').trim().toLowerCase();
  const since = f.period === '7'    ? now - 7 * 86400000
              : f.period === '30'   ? now - 30 * 86400000
              : f.period === 'year' ? new Date(new Date(now).getFullYear(), 0, 1).getTime()
              : null;

  return (logs || []).filter(l => {
    if (f.texture && l.texture !== f.texture) return false;
    if (f.color   && l.color   !== f.color)   return false;
    if (f.place   && (l.place || '') !== f.place) return false;
    if (since !== null && l.date < since) return false;
    if (!q) return true;
    // La date est cherchable en toutes lettres : « janvier », « lundi », « 2026 ».
    const place = window.PoopMapModule?.placeMeta(l.place)?.label || '';
    const dt = new Date(l.date).toLocaleDateString('fr-FR',
      { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const sante = (Array.isArray(l.health) ? l.health : [])
      .map(t => (typeof healthTagMeta === 'function' ? healthTagMeta(t)?.label : '') || t);
    return [l.texture, l.color, l.mood, l.comment, place, dt, ...sante]
      .filter(Boolean).join(' ').toLowerCase().includes(q);
  });
}

function renderHistory() {
  const list = $id('history-list');
  if (!list) return;
  const matches = filterLogs(state.logs);
  const recent  = matches.slice(0, historyShown);

  // Compteur, bouton « voir plus » et bouton de réinitialisation
  const countEl = $id('history-count');
  if (countEl) {
    countEl.textContent = state.logs.length === 0 ? ''
      : `${matches.length} caca${matches.length > 1 ? 's' : ''}` +
        (matches.length > recent.length ? ` — ${recent.length} affiché${recent.length > 1 ? 's' : ''}` : '');
  }
  $id('history-more')?.classList.toggle('hidden', matches.length <= recent.length);
  $id('history-reset')?.classList.toggle('hidden', !historyFiltersActive());

  if (!recent.length) {
    list.innerHTML = historyFiltersActive()
      ? `<div class="text-center py-12 opacity-60">
          <div class="text-5xl mb-3">🔎</div>
          <div class="font-bold text-lg">Aucun résultat</div>
          <div class="text-sm">Essaie avec moins de filtres.</div>
        </div>`
      : `<div class="text-center py-12 opacity-60">
          <div class="text-5xl mb-3">📭</div>
          <div class="font-bold text-lg">Aucun caca enregistré</div>
          <div class="text-sm">Clémence, c'est le moment !</div>
        </div>`;
    return;
  }
  list.innerHTML = recent.map(log => {
    const dt = new Date(log.date).toLocaleString('fr-FR', {weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
    const icon = textureEmoji(log.texture);
    const retroTag = log.isRetro ? `<span class="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full ml-1 font-bold">⏪ retard</span>` : '';
    const placeMeta = window.PoopMapModule?.placeMeta(log.place);
    const placeTag = placeMeta
      ? `<span class="text-xs px-2 py-0.5 rounded-full mr-1" style="background:color-mix(in srgb,var(--accent) 12%,transparent)">${placeMeta.emoji} ${esc(placeMeta.label)}${window.PoopMapModule.hasGeo(log) ? ' 📍' : ''}</span>`
      : '';
    const chip = txt => `<span class="text-xs px-2 py-0.5 rounded-full mr-1" style="background:color-mix(in srgb,var(--accent) 12%,transparent)">${txt}</span>`;
    const dureeTag = typeof validDuration === 'function' && validDuration(log.duration) !== null
      ? chip('⏱️ ' + formatDuration(log.duration)) : '';
    const santeTags = (Array.isArray(log.health) ? log.health : [])
      .map(t => typeof healthTagMeta === 'function' ? healthTagMeta(t) : null).filter(Boolean)
      .map(m => chip(`${m.emoji} ${esc(m.label)}`)).join('');
    const note = placeTag + dureeTag + santeTags + (log.mood ? `<span class="text-xs px-2 py-0.5 rounded-full mr-1" style="background:color-mix(in srgb,var(--accent) 12%,transparent)">${{normal:'😊',douloureux:'😫',urgent:'⚡',difficile:'😴'}[log.mood] || ''} ${log.mood}</span>` : '') + (log.comment ? `<div class="text-xs mt-1 bg-amber-100 text-amber-800 px-2 py-1 rounded-xl">${esc(log.comment)}</div>` : '');
    return `<div class="card flex items-center gap-3 p-4 rounded-[1.5rem] shadow">
      <div class="w-12 h-12 rounded-[1rem] flex items-center justify-center text-2xl flex-shrink-0"
        style="background:linear-gradient(135deg,var(--header-from),var(--header-to))">${icon}</div>
      <div class="flex-1 min-w-0">
        <div class="font-bold capitalize text-sm">${esc(log.texture)} ${retroTag}</div>
        <div class="text-xs capitalize opacity-60">${esc(log.color)}</div>
        ${note}
        <div class="text-xs opacity-40 mt-1">${dt}</div>
      </div>
      <button class="p-2 opacity-50 hover:opacity-100 transition-opacity" onclick="editLog('${log.id || state.logs.indexOf(log)}')" aria-label="Modifier">
        <svg class="icon text-sm"><use href="#i-edit"/></svg>
      </button>
      <button class="p-2 text-red-400 hover:text-red-600 transition-colors" onclick="deleteLog('${log.id || state.logs.indexOf(log)}')" aria-label="Supprimer">
        <svg class="icon text-sm"><use href="#i-trash"/></svg>
      </button>
    </div>`;
  }).join('');
}

window.deleteLog = function(idOrIndex) {
  const idx = state.logs.findIndex(l => String(l.id) === String(idOrIndex) || String(state.logs.indexOf(l)) === String(idOrIndex));
  if (idx === -1) return;
  const deleted = state.logs[idx];
  state.logs.splice(idx, 1);
  saveState(state);
  renderAll();
  if (window.SupabaseClient?.isLoggedIn()) {
    if (navigator.onLine) {
      window.SupabaseClient.deletePoopCloud(deleted.id).catch(e => $debug('cloud del err: ' + e.message));
    } else {
      enqueueOffline({ type: 'del', id: deleted.id });
    }
  }
  $debug('🗑️ deleted');
};

// ===================================================
//  STATS
// ===================================================
function renderStats() {
  // Fréquence 7j
  const now = new Date();
  let totalLast7 = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    totalLast7 += state.logs.filter(l => new Date(l.date).toDateString() === d.toDateString()).length;
  }
  const avgPerDay = totalLast7 / 7;
  const maxFreq = 2.5;

  $id('bar-me').style.width = Math.min(100, (avgPerDay / maxFreq) * 100) + '%';
  $id('val-me').textContent = avgPerDay.toFixed(1) + '/j';

  // Verdict
  const fv = $id('freq-verdict');
  if (!fv) return;
  if (avgPerDay === 0) {
    fv.textContent = '📭 Aucune donnée cette semaine…';
    fv.style.cssText = 'background:rgba(100,116,139,0.1);color:#64748b';
  } else if (avgPerDay < 0.5) {
    fv.textContent = '😬 Attention à la constipation ! En dessous des normes.';
    fv.style.cssText = 'background:rgba(239,68,68,0.1);color:#dc2626';
  } else if (avgPerDay < 1.0) {
    fv.textContent = '🙂 Norme basse — tout va bien !';
    fv.style.cssText = 'background:rgba(234,179,8,0.12);color:#b45309';
  } else if (avgPerDay <= 2.0) {
    fv.textContent = '🏆 Dans les normes françaises et mondiales, bravo Clémence !';
    fv.style.cssText = 'background:rgba(5,150,105,0.12);color:#059669';
  } else {
    fv.textContent = '🚨 Plus de 2/j — surveille peut-être l\'alimentation ?';
    fv.style.cssText = 'background:rgba(249,115,22,0.12);color:#ea580c';
  }

  // Transit
  const sorted = [...state.logs].sort((a, b) => a.date - b.date);
  let avgTransitH = null;
  if (sorted.length >= 2) {
    let totalGap = 0;
    for (let i = 1; i < sorted.length; i++) totalGap += sorted[i].date - sorted[i-1].date;
    avgTransitH = totalGap / (sorted.length - 1) / 3600000;
  }
  if (avgTransitH !== null) {
    const h = Math.round(avgTransitH);
    $id('val-transit-me').textContent = h + 'h';
    $id('bar-transit-me').style.width = Math.min(100, (h / 72) * 100) + '%';
  } else {
    $id('val-transit-me').textContent = '—';
    $id('bar-transit-me').style.width = '0%';
  }

  // Textures
  const textures = ['normal','dur','mou','spray','liquide','explosif'];
  const total = state.logs.length || 1;
  const tstats = $id('texture-stats');
  tstats.innerHTML = textures.map(t => {
    const count = state.logs.filter(l => l.texture === t).length;
    const pct = Math.round((count / total) * 100);
    const emoji = textureEmoji(t);
    let fillColor = '#f59e0b';
    if (t === 'normal') fillColor = '#10b981';
    if ((t === 'liquide' || t === 'explosif') && pct > 5) fillColor = '#ef4444';
    return `<div style="display:grid;grid-template-columns:28px 64px 1fr 40px 36px;align-items:center;gap:6px;">
      <span>${emoji}</span>
      <span class="text-xs font-bold capitalize opacity-80">${t}</span>
      <div class="stat-bar"><div class="stat-fill" style="width:${pct}%;background:${fillColor}"></div></div>
      <span class="text-xs font-bold text-right">${pct}%</span>
      <span class="text-xs opacity-40">(${count})</span>
    </div>`;
  }).join('');

  // Comparaison mensuelle
  renderMonthCompare();
  // Score santé intestinale
  renderHealthScore();

  // Records personnels (feature 9)
  renderPersonalRecords();

  // Durée des séances et carnet de santé (v2.18.0, app-sante.js)
  if (typeof renderDurationCard === 'function') renderDurationCard();
  if (typeof renderInsightsCard === 'function') renderInsightsCard();

  // Bristol Scale (feature 17)
  renderBristolScale();

  // Totaux par année
  renderYearlyTotals();

  // PoopMap (poopmap.js)
  const poopmapEl = $id('poopmap-container');
  if (poopmapEl && window.PoopMapModule) window.PoopMapModule.renderCard(state.logs, poopmapEl);

  // Calendrier mensuel (charts.js) — pose ses propres écouteurs, une seule fois
  if (typeof renderCalendar === 'function') renderCalendar(state.logs);
  // Graphiques avancés (charts.js)
  if (typeof createAllCharts === 'function' && state.logs.length > 0) {
    const chartsEl = $id('advanced-charts-container');
    if (chartsEl) chartsEl.innerHTML = createAllCharts(state.logs);
  }
}

// ===================================================
//  TOTAUX PAR ANNÉE
// ===================================================
// Fonction pure : une ligne par année, de la plus récente à la plus ancienne.
function yearlyTotals(logs, now = Date.now()) {
  const annees = {};
  (logs || []).forEach(l => {
    const d = new Date(l.date);
    const y = d.getFullYear();
    (annees[y] = annees[y] || { year: y, total: 0, mois: {}, jours: new Set() });
    annees[y].total++;
    annees[y].mois[d.getMonth()] = (annees[y].mois[d.getMonth()] || 0) + 1;
    annees[y].jours.add(d.toDateString());
  });

  const aujourdhui = new Date(now);
  return Object.values(annees).sort((a, b) => b.year - a.year).map(a => {
    // Moyenne rapportée aux jours écoulés : l'année en cours n'est pas divisée
    // par 365, sinon elle paraîtrait toujours catastrophique en janvier.
    const enCours = a.year === aujourdhui.getFullYear();
    const jours = enCours
      ? Math.max(1, Math.round((aujourdhui - new Date(a.year, 0, 1)) / 86400000) + 1)
      : (a.year % 4 === 0 && (a.year % 100 !== 0 || a.year % 400 === 0)) ? 366 : 365;
    const [moisIdx] = Object.entries(a.mois).sort((x, y) => y[1] - x[1])[0];
    return {
      year: a.year,
      total: a.total,
      parJour: a.total / jours,
      joursActifs: a.jours.size,
      meilleurMois: Number(moisIdx),
      meilleurMoisTotal: a.mois[moisIdx],
      enCours,
    };
  });
}

const MOIS_FR = ['janvier','février','mars','avril','mai','juin',
                 'juillet','août','septembre','octobre','novembre','décembre'];

/** Fonction pure : un bilan par mois, du plus récent au plus ancien. */
function monthlyTotals(logs, now = Date.now(), limite = 12) {
  const mois = {};
  (logs || []).forEach(l => {
    const d = new Date(l.date);
    const cle = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    (mois[cle] = mois[cle] || { year: d.getFullYear(), month: d.getMonth(), total: 0, jours: new Set() });
    mois[cle].total++;
    mois[cle].jours.add(d.getDate());
  });

  const aujourdhui = new Date(now);
  return Object.values(mois)
    .sort((a, b) => b.year - a.year || b.month - a.month)
    .slice(0, limite)
    .map(m => {
      const enCours = m.year === aujourdhui.getFullYear() && m.month === aujourdhui.getMonth();
      // Comme pour l'année : le mois en cours se juge sur les jours écoulés.
      const jours = enCours ? aujourdhui.getDate() : new Date(m.year, m.month + 1, 0).getDate();
      return {
        cle: `${MOIS_FR[m.month]} ${m.year}`,
        total: m.total,
        parJour: m.total / jours,
        joursActifs: m.jours.size,
        enCours,
      };
    });
}

// Vue courante du bloc bilan : 'annee' ou 'mois'.
let bilanVue = (() => { try { return localStorage.getItem('stats.bilanVue') || 'annee'; } catch { return 'annee'; } })();

window.setBilanVue = function(vue) {
  bilanVue = vue;
  try { localStorage.setItem('stats.bilanVue', vue); } catch {}
  renderYearlyTotals();
};

function renderYearlyTotals() {
  const el = $id('yearly-container');
  if (!el) return;

  const parAnnee = bilanVue === 'annee';
  const lignes = parAnnee
    ? yearlyTotals(state.logs).map(a => ({
        cle: String(a.year), total: a.total, parJour: a.parJour,
        joursActifs: a.joursActifs, enCours: a.enCours,
        detail: `meilleur mois : ${MOIS_FR[a.meilleurMois]} (${a.meilleurMoisTotal})`,
      }))
    : monthlyTotals(state.logs).map(m => ({ ...m, detail: '' }));

  if (!lignes.length) { el.innerHTML = ''; return; }
  const max = Math.max(...lignes.map(l => l.total));

  el.innerHTML = `
    <div class="card rounded-[2rem] p-5 shadow">
      <div class="flex items-center justify-between mb-1 gap-2">
        <h4 class="font-bold">📅 Bilan</h4>
        <div class="seg">
          <button type="button" class="seg-btn${parAnnee ? ' seg-on' : ''}" onclick="setBilanVue('annee')">Année</button>
          <button type="button" class="seg-btn${parAnnee ? '' : ' seg-on'}" onclick="setBilanVue('mois')">Mois</button>
        </div>
      </div>
      <p class="text-xs opacity-60 mb-4">${parAnnee ? 'Ton bilan depuis le début' : 'Les 12 derniers mois où tu as cacé'}</p>
      <div class="space-y-3">
        ${lignes.map(l => `
          <div>
            <div class="flex items-center justify-between text-sm mb-1">
              <span class="font-bold capitalize">${esc(l.cle)}${l.enCours ? ' <span class="text-xs opacity-50">(en cours)</span>' : ''}</span>
              <span class="font-bold">${l.total} caca${l.total > 1 ? 's' : ''}</span>
            </div>
            <div class="stat-bar mb-1"><div class="stat-fill" style="width:${(l.total / max * 100).toFixed(0)}%;background:var(--accent)"></div></div>
            <div class="text-xs opacity-60">
              ${l.parJour.toFixed(2)}/jour · ${l.joursActifs} jour${l.joursActifs > 1 ? 's' : ''} actif${l.joursActifs > 1 ? 's' : ''}${l.detail ? ' · ' + l.detail : ''}
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

// ===================================================
//  STREAK
// ===================================================
// Streak "tolérant" (v2.10.0) : 1 jour raté est pardonné (joker 🃏),
// dans la limite d'un joker par fenêtre de 7 jours, si le jour précédent
// le trou a bien un caca. Le jour joker ne compte pas dans le total.
// `depart` : 0 = la série doit inclure aujourd'hui, 1 = elle part d'hier.
// Rend aussi les jours pardonnés, pour pouvoir le dire à l'utilisatrice.
function streakCore(source, now = Date.now(), depart = 0) {
  const jours = new Set((source || []).map(l => new Date(l.date).toDateString()));
  const jour = i => { const d = new Date(now); d.setDate(d.getDate() - i); return d; };
  const aJour = i => jours.has(jour(i).toDateString());
  if (!aJour(depart)) return { streak: 0, jokers: [] };
  let streak = 1;
  let lastJokerAt = -Infinity;
  const jokers = [];
  for (let i = depart + 1; i < depart + 366; i++) {
    if (aJour(i)) { streak++; continue; }
    if (i - lastJokerAt >= 7 && aJour(i + 1)) {
      lastJokerAt = i; // joker consommé : le trou est pardonné mais ne compte pas
      const d = jour(i); d.setHours(0, 0, 0, 0);
      jokers.push(d.getTime());
      continue;
    }
    break;
  }
  return { streak, jokers };
}

function calculateStreak(logs) {
  // Le paramètre sert à calculer le streak d'une copine (rareté des badges) ;
  // sans lui, c'est celui de l'utilisatrice.
  return streakCore(logs || state.logs).streak;
}

/**
 * Série vue par l'utilisatrice (v2.18.0). Pas encore de caca aujourd'hui ne
 * veut pas dire série perdue : celle d'hier tient jusqu'à minuit. `pending`
 * porte alors sa longueur, pour afficher « en attente » plutôt qu'un 0 sec.
 */
function streakDetails(logs, now = Date.now()) {
  const source = logs || state.logs;
  const aujourdhui = streakCore(source, now, 0);
  if (aujourdhui.streak > 0) return { current: aujourdhui.streak, pending: 0, jokers: aujourdhui.jokers };
  const hier = streakCore(source, now, 1);
  return { current: 0, pending: hier.streak, jokers: hier.jokers };
}

function updateStreakBadge() {
  const { current, pending } = streakDetails();
  const el = $id('streak-badge');
  if (!el) return;
  const valeur = current || pending;
  if (valeur >= 2) {
    el.style.display = 'flex';
    $id('streak-val').textContent = valeur;
    // En attente : même flamme, mais pâlie, et le titre explique pourquoi.
    el.classList.toggle('streak-pending', !current);
    el.title = current
      ? `Série de ${current} jours`
      : `Série de ${pending} jours en attente : un caca avant minuit pour la garder`;
  } else {
    el.style.display = 'none';
  }
}

/**
 * Fonction pure : le joker qui vient de sauver la série et qu'on n'a pas
 * encore annoncé (le plus récent, s'il date d'hier ou d'avant-hier).
 */
function jokerToAnnounce(details, dejaAnnonce, now = Date.now()) {
  if (!details || !details.current || !details.jokers?.length) return null;
  const recent = Math.max(...details.jokers);
  const debutAujourdhui = new Date(now); debutAujourdhui.setHours(0, 0, 0, 0);
  if (debutAujourdhui.getTime() - recent > 2 * 86400000) return null;
  if (Number(dejaAnnonce) === recent) return null;
  return recent;
}
