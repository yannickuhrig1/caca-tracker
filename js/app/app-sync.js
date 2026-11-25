// ============================================================
//  app-sync.js
//  graphique 7 jours, sync cloud, file offline, export/reset, confettis
//  Extrait du bloc <script> de index.html. L'ordre de chargement
//  est significatif : ces fichiers partagent la portee globale.
// ============================================================

// ===================================================
//  CHART
// ===================================================
function initChart() {
  if (!window.Chart) {
    $id('chart-fallback')?.classList.remove('hidden');
    return;
  }
  try {
    const ctx = $id('week-chart').getContext('2d');
    weekChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: 'rgba(251,191,36,.8)',
          borderColor: '#d97706',
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } }
      }
    });
    updateChart();
  } catch(e) {
    $id('chart-fallback')?.classList.remove('hidden');
    $debug('chart err: ' + e.message);
  }
}

function updateChart() {
  if (!weekChart) return;
  const labels = [], data = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('fr-FR', {weekday:'short'}));
    data.push(state.logs.filter(l => new Date(l.date).toDateString() === d.toDateString()).length);
  }
  weekChart.data.labels = labels;
  weekChart.data.datasets[0].data = data;
  weekChart.update('none');
}

// ===================================================
//  CLOUD → LOCAL SYNC (incrémentale + repli complet)
// ===================================================
const LAST_SYNC_KEY = 'cacaTracker.lastSyncAt';

function readLastSyncAt() {
  try {
    const raw = localStorage.getItem(LAST_SYNC_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeLastSyncAt(ts = Date.now()) {
  try {
    localStorage.setItem(LAST_SYNC_KEY, String(ts));
  } catch {}
}

function logUpdateTimestamp(entry) {
  if (!entry || typeof entry !== 'object') return 0;
  for (const v of [entry.updatedAt, entry.updated_at, entry.ts]) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const num = Number(v);
      if (Number.isFinite(num)) return num;
      const parsed = Date.parse(v);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function logSortTimestamp(entry) {
  if (!entry || typeof entry !== 'object') return 0;
  if (typeof entry.date === 'number' && Number.isFinite(entry.date)) return entry.date;
  if (typeof entry.date === 'string' && entry.date.trim() !== '') {
    const num = Number(entry.date);
    if (Number.isFinite(num)) return num;
    const parsed = Date.parse(entry.date);
    if (Number.isFinite(parsed)) return parsed;
  }
  return logUpdateTimestamp(entry);
}

/**
 * Fusionne proprement les logs locaux et distants par `id` sans perte ni doublon,
 * en conservant la version la plus récente selon `updatedAt` / `updated_at` / `ts`.
 */
function mergeIncrementalLogs(localLogs, remoteLogs) {
  const byId = new Map();
  const ingest = list => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      if (item.id === undefined || item.id === null || item.id === '') continue;
      const key = String(item.id);
      if (key === 'undefined' || key === 'null') continue;
      if (!byId.has(key)) {
        byId.set(key, { ...item });
        continue;
      }
      const existing = byId.get(key);
      if (logUpdateTimestamp(item) > logUpdateTimestamp(existing)) {
        byId.set(key, { ...item });
      }
    }
  };
  ingest(localLogs);
  ingest(remoteLogs);
  return Array.from(byId.values()).sort((a, b) => {
    const diff = logSortTimestamp(b) - logSortTimestamp(a);
    if (diff !== 0) return diff;
    return String(b.id).localeCompare(String(a.id));
  });
}
window.mergeIncrementalLogs = mergeIncrementalLogs;

async function fetchIncrementalPoops(sc, sinceMs) {
  if (typeof sc.getMyPoopsSince === 'function') {
    return await sc.getMyPoopsSince(sinceMs);
  }
  const sb = sc.getClient?.();
  const uid = sc.getCurrentProfile?.()?.id;
  if (!sb || !uid || typeof sb.from !== 'function') {
    return await sc.getMyPoops();
  }

  const baseCols = 'id, local_id, date, texture, color, comment, is_retro, mood, updated_at';
  const geoCols  = sc.geoColumnsAvailable?.() !== false ? ', place, lat, lon, city, region, country, country_code' : '';
  const durCol   = sc.durationColumnAvailable?.() !== false ? ', duration_s' : '';
  const sinceWindow = Math.max(0, sinceMs - 5000);

  const { data, error } = await sb.from('poops')
    .select(baseCols + geoCols + durCol)
    .eq('user_id', uid)
    .gte('updated_at', sinceWindow)
    .order('date', { ascending: false });
  if (error) return await sc.getMyPoops();

  const rowsRaw = Array.isArray(data) ? data : [];
  const healthAvail = sc.healthTableAvailable?.() !== false;

  if (!rowsRaw.length) {
    // Si seul le carnet de santé a bougé depuis lastSyncAt, on repasse en pull complet.
    if (healthAvail) {
      try {
        const { data: hChanged, error: hErr } = await sb.from('poop_health')
          .select('local_id')
          .eq('user_id', uid)
          .gte('updated_at', sinceWindow)
          .limit(1);
        if (!hErr && Array.isArray(hChanged) && hChanged.length) {
          return await sc.getMyPoops();
        }
      } catch {}
    }
    return [];
  }

  let healthMap = {};
  if (healthAvail) {
    try {
      const ids = rowsRaw.map(p => String(p.local_id || p.id)).filter(Boolean);
      const { data: hRows, error: hErr } = await sb.from('poop_health')
        .select('local_id, tags')
        .eq('user_id', uid)
        .in('local_id', ids);
      if (!hErr && Array.isArray(hRows)) {
        healthMap = Object.fromEntries(hRows.map(r => [String(r.local_id), r.tags || []]));
      }
    } catch {}
  }

  return rowsRaw.map(p => {
    const log = {
      id:         p.local_id || p.id,
      date:       p.date,
      texture:    p.texture || 'normal',
      color:      p.color   || 'marron',
      comment:    p.comment || '',
      isRetro:    p.is_retro || false,
      mood:       p.mood    || '',
      place:      p.place   || null,
      updated_at: p.updated_at || 0
    };
    if (typeof p.lat === 'number' && typeof p.lon === 'number') { log.lat = p.lat; log.lon = p.lon; }
    if (p.city)         log.city        = p.city;
    if (p.region)       log.region      = p.region;
    if (p.country)      log.country     = p.country;
    if (p.country_code) log.countryCode = p.country_code;
    if (typeof p.duration_s === 'number' && p.duration_s > 0 && p.duration_s <= 14400) log.duration = Math.round(p.duration_s);
    const tags = healthMap[String(log.id)];
    if (tags?.length) log.health = tags;
    return log;
  });
}

async function syncCloudData(options = {}) {
  const sc = window.SupabaseClient;
  if (!sc?.isLoggedIn()) return;
  try {
    // Nettoyage des doublons invalides :
    //  - UUID (ancienne clé p.id au lieu de p.local_id)
    //  - id undefined/null/"undefined" (bug du fix précédent qui utilisait p.local_id inexistant)
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
    const before = state.logs.length;
    state.logs = state.logs.filter(l => {
      const s = String(l.id);
      return l.id && s !== 'undefined' && s !== 'null' && !uuidRe.test(s);
    });
    if (state.logs.length !== before) {
      saveState(state);
      $debug(`🧹 ${before - state.logs.length} doublon(s) invalide(s) supprimé(s)`);
    }

    const forceFull = options === true || Boolean(options && options.forceFull);
    const lastSyncAt = forceFull ? null : readLastSyncAt();
    const syncStartedAt = Date.now();

    const cloudPoops = lastSyncAt
      ? await fetchIncrementalPoops(sc, lastSyncAt)
      : await sc.getMyPoops();

    if (Array.isArray(cloudPoops) && cloudPoops.length) {
      // getMyPoops() retourne { id: local_id, date, texture, ... } — pas de propriété local_id séparée
      // On utilise donc p.id qui contient déjà le timestamp local
      const localMap = new Map(state.logs.map(l => [String(l.id), l]));
      const normalizedRemote = [];
      let changed = 0;

      for (const p of cloudPoops) {
        const key = String(p.id);
        const local = localMap.get(key);
        const cloudUpdAt = p.updated_at || 0;
        const localUpdAt = local?.updated_at || 0;

        if (!local || cloudUpdAt > localUpdAt) {
          const entry = local ? { ...local } : {};
          Object.assign(entry, {
            id:         p.id,
            date:       p.date,
            texture:    p.texture,
            color:      p.color,
            comment:    p.comment || '',
            isRetro:    p.isRetro,
            mood:       p.mood || null,
            updated_at: p.updated_at
          });
          applyPoopMapFields(entry, p);
          applyExtraFields(entry, p);
          normalizedRemote.push(entry);
          changed++;
        }
      }

      if (changed > 0) {
        state.logs = mergeIncrementalLogs(state.logs, normalizedRemote);
        saveState(state);
        renderAll();
        $debug(`☁️ ${changed} entrée(s) synchronisée(s) depuis le cloud`);
      }
    }

    writeLastSyncAt(syncStartedAt);
  } catch(e) {
    $debug('cloud sync err: ' + e.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('sync-cloud-btn')?.addEventListener('click', () => {
    syncCloudData({ forceFull: true });
  });
});
// Champs PoopMap d'une entrée cloud. Une position effacée ailleurs doit
// disparaître ici aussi : on supprime lat/lon plutôt que de les laisser à null,
// car `hasGeo` teste la présence de nombres.
function applyPoopMapFields(target, cloud) {
  target.place = cloud.place || null;
  if (typeof cloud.lat === 'number' && typeof cloud.lon === 'number') {
    target.lat = cloud.lat;
    target.lon = cloud.lon;
  } else {
    delete target.lat;
    delete target.lon;
  }
  // Zone de conquête : même règle, absente plutôt que nulle.
  ['city', 'region', 'country', 'countryCode'].forEach(champ => {
    if (cloud[champ]) target[champ] = cloud[champ];
    else delete target[champ];
  });
  return target;
}

// Durée et carnet de santé (migration 15). Tant que la base ne les a pas, le
// cloud ne les renvoie pas : ce n'est pas une suppression, on garde le local.
function applyExtraFields(target, cloud, dispo = {
  duration: window.SupabaseClient?.durationColumnAvailable?.() !== false,
  health:   window.SupabaseClient?.healthTableAvailable?.() !== false,
}) {
  if (dispo.duration) {
    if (cloud.duration) target.duration = cloud.duration;
    else delete target.duration;
  }
  if (dispo.health) {
    if (Array.isArray(cloud.health) && cloud.health.length) target.health = [...cloud.health];
    else delete target.health;
  }
  return target;
}

window.syncCloudData = syncCloudData;

// ===================================================
//  RATTRAPAGE POOPMAP (v2.15.1)
// ===================================================
// Le lieu et la position sont arrivés après coup (migrations 13 et 14) : les
// cacas enregistrés avant existent dans le cloud sans ces colonnes. Le
// démarrage ne fait qu'un pull (cloud → local) ; seul afterLogin() pousse
// dans l'autre sens. Sans ça, il fallait se déconnecter/reconnecter à la
// main pour que la carte suive d'un appareil à l'autre.
const POOPMAP_BACKFILL_KEY = 'poopmap.cloudBackfill.v1';

// Fonction pure : les entrées qui portent quelque chose à repousser.
function poopMapEntriesToPush(logs) {
  const mod = window.PoopMapModule;
  return (logs || []).filter(l => l.place || mod?.hasGeo(l) || mod?.hasZone(l));
}

async function maybeBackfillPoopMapCloud() {
  if (!LS_OK || localStorage.getItem(POOPMAP_BACKFILL_KEY)) return;
  if (!window.SupabaseClient?.isLoggedIn() || !navigator.onLine) return;

  const aPousser = poopMapEntriesToPush(state.logs);
  if (!aPousser.length) {
    localStorage.setItem(POOPMAP_BACKFILL_KEY, '1');   // rien à rattraper
    return;
  }

  try {
    await window.SupabaseClient.syncLocalToCloud(aPousser);
    // Si la base n'a pas encore les colonnes, la requête est rejouée sans
    // elles : le rattrapage n'a rien rattrapé, on réessaiera au prochain
    // lancement plutôt que de le marquer fait.
    if (window.SupabaseClient.geoColumnsAvailable?.() === false) {
      $debug('☁️ rattrapage reporté : colonnes PoopMap absentes en base');
      return;
    }
    localStorage.setItem(POOPMAP_BACKFILL_KEY, '1');
    $debug(`☁️ ${aPousser.length} entrée(s) repoussée(s) avec lieu/position`);
  } catch (e) {
    $debug('backfill err: ' + e.message);   // sans marquer : nouvelle tentative au prochain lancement
  }
}
window.maybeBackfillPoopMapCloud = maybeBackfillPoopMapCloud;

// Même rattrapage pour la durée et le carnet de santé (v2.18.0, migration 15) :
// ce qui a été saisi avant que la base les connaisse est repoussé une fois.
const EXTRAS_BACKFILL_KEY = 'sante.cloudBackfill.v1';

/** Fonction pure : entrées portant une durée ou des étiquettes de santé. */
function extraEntriesToPush(logs) {
  return (logs || []).filter(l => l.duration || (Array.isArray(l.health) && l.health.length));
}

async function maybeBackfillExtrasCloud() {
  if (!LS_OK || localStorage.getItem(EXTRAS_BACKFILL_KEY)) return;
  if (!window.SupabaseClient?.isLoggedIn() || !navigator.onLine) return;

  const aPousser = extraEntriesToPush(state.logs);
  if (!aPousser.length) { localStorage.setItem(EXTRAS_BACKFILL_KEY, '1'); return; }

  try {
    await window.SupabaseClient.syncLocalToCloud(aPousser);
    const sc = window.SupabaseClient;
    if (sc.durationColumnAvailable?.() === false || sc.healthTableAvailable?.() === false) {
      $debug('☁️ rattrapage durée/santé reporté : migration 15 absente');
      return;
    }
    localStorage.setItem(EXTRAS_BACKFILL_KEY, '1');
    $debug(`☁️ ${aPousser.length} entrée(s) repoussée(s) avec durée/santé`);
  } catch (e) {
    $debug('backfill extras err: ' + e.message);
  }
}
window.maybeBackfillExtrasCloud = maybeBackfillExtrasCloud;

// ===================================================
//  OFFLINE QUEUE  (feature 14)
// ===================================================
// Un item qui échoue pour une raison définitive (compte supprimé, donnée
// rejetée) était jusqu'ici remis en file à chaque tentative, donc réessayé
// indéfiniment. La file n'avait par ailleurs aucun plafond : un long passage
// hors ligne pouvait saturer le localStorage et faire perdre en silence les
// entrées suivantes.
const QUEUE_KEY          = 'cacaTracker.offlineQueue';
const QUEUE_MAX          = 500;   // au-delà, on écarte les plus anciens
const QUEUE_MAX_ESSAIS    = 5;    // au-delà, l'item est abandonné

/** Lit la file, en tolérant un contenu corrompu. */
function readQueue() {
  try {
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(q) ? q : [];
  } catch { return []; }
}

/**
 * Ajoute un item en respectant le plafond.
 * Fonction pure : rend la nouvelle file et ce qui a été écarté, pour que
 * l'appelant décide quoi en dire à l'utilisatrice.
 */
function pushToQueue(queue, item, max = QUEUE_MAX) {
  const suivante = [...queue, { ...item, essais: 0 }];
  if (suivante.length <= max) return { queue: suivante, ecartes: [] };
  const trop = suivante.length - max;
  return { queue: suivante.slice(trop), ecartes: suivante.slice(0, trop) };
}

/**
 * Trie le résultat d'une passe de synchronisation.
 * Fonction pure, testable sans réseau : à partir des items et de leur issue,
 * rend ceux à réessayer et ceux à abandonner définitivement.
 */
function triageQueue(resultats, maxEssais = QUEUE_MAX_ESSAIS) {
  const aReessayer = [], abandonnes = [];
  for (const { item, ok } of resultats) {
    if (ok) continue;
    const essais = (item.essais || 0) + 1;
    (essais >= maxEssais ? abandonnes : aReessayer).push({ ...item, essais });
  }
  return { aReessayer, abandonnes };
}

function enqueueOffline(item) {
  try {
    const { queue, ecartes } = pushToQueue(readQueue(), item);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    if (ecartes.length) {
      $debug(`⚠️ File offline pleine — ${ecartes.length} en attente écarté(s)`);
      window.UI?.toast(`File d'attente pleine : ${ecartes.length} modification(s) hors ligne perdue(s).`, 'error');
    }
    return true;
  } catch (e) {
    $debug('queue err: ' + e.message);
    return false;
  }
}
window.enqueueOffline = enqueueOffline;

async function processOfflineQueue() {
  if (!window.SupabaseClient?.isLoggedIn()) return;
  const queue = readQueue();
  if (!queue.length) return;

  const resultats = [];
  for (const item of queue) {
    try {
      if (item.type === 'add')      await window.SupabaseClient.savePoopCloud(item.poop);
      else if (item.type === 'del') await window.SupabaseClient.deletePoopCloud(item.id);
      resultats.push({ item, ok: true });
    } catch (e) {
      $debug('queue flush err: ' + e.message);
      resultats.push({ item, ok: false });
    }
  }

  const { aReessayer, abandonnes } = triageQueue(resultats);

  // Un abandon doit se voir : sinon une entrée disparaît du cloud sans que
  // personne ne le sache, alors qu'elle reste visible en local.
  if (abandonnes.length) {
    $debug(`❌ ${abandonnes.length} élément(s) abandonné(s) après ${QUEUE_MAX_ESSAIS} tentatives`);
    window.UI?.toast(
      `${abandonnes.length} modification(s) n'ont pas pu être synchronisée(s) et ont été abandonnées.`,
      'error', 6000);
  }

  if (aReessayer.length) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(aReessayer));
  } else {
    localStorage.removeItem(QUEUE_KEY);
    if (resultats.length) $debug('✅ File offline vidée — tout synchronisé');
  }
}
window.processOfflineQueue = processOfflineQueue;

// ===================================================
//  EXPORT / CLEAR
// ===================================================
function exportData() {
  try {
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'clemence-caca-tracker.json'; a.click();
    URL.revokeObjectURL(url);
    $debug('📤 export ok');
  } catch(e) { $debug('export err: ' + e.message); }
}

// Export CSV — le tableur de la famille lit ça mieux que du JSON, et c'est
// aussi ce que propose PoopMap. Séparateur « ; » : Excel FR et Sheets le
// reconnaissent, la virgule ferait tout tomber dans une seule colonne.
function toCSV(logs) {
  const cols = ['date_iso', 'date', 'heure', 'texture', 'couleur', 'humeur',
                'lieu', 'latitude', 'longitude', 'en_retard', 'duree_s', 'sante', 'note'];
  const santeLabel = id => (typeof healthTagMeta === 'function' && healthTagMeta(id)?.label) || id;
  const cell = v => {
    const t = String(v ?? '');
    return /[";\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  };
  const lignes = (logs || []).slice().sort((a, b) => b.date - a.date).map(l => {
    const d = new Date(l.date);
    return [
      d.toISOString(),
      d.toLocaleDateString('fr-FR'),
      d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      l.texture || '', l.color || '', l.mood || '',
      window.PoopMapModule?.placeMeta(l.place)?.label || '',
      typeof l.lat === 'number' ? l.lat : '',
      typeof l.lon === 'number' ? l.lon : '',
      l.isRetro ? 'oui' : 'non',
      l.duration || '',
      (Array.isArray(l.health) ? l.health : []).map(santeLabel).join(', '),
      l.comment || '',
    ].map(cell).join(';');
  });
  return [cols.join(';'), ...lignes].join('\n');
}

function exportCSV() {
  try {
    if (!state.logs.length) { window.UI.toast('Aucun caca à exporter.', 'info'); return; }
    // BOM : sans lui, Excel affiche « CafÃ© » à la place des accents.
    const blob = new Blob(['\ufeff' + toCSV(state.logs)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'clemence-caca-tracker.csv'; a.click();
    URL.revokeObjectURL(url);
    $debug('📤 export csv ok');
  } catch(e) { $debug('export csv err: ' + e.message); }
}

function importData() {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!imported.logs || !Array.isArray(imported.logs)) {
        window.UI.toast('Fichier invalide : aucune entrée trouvée.', 'error');
        return;
      }
      const existingIds = new Set(state.logs.map(l => String(l.id)));
      const newLogs = imported.logs.filter(l => !existingIds.has(String(l.id)));
      state.logs = [...state.logs, ...newLogs].sort((a, b) => b.date - a.date);
      saveState(state);
      renderAll();
      window.UI.toast(`${newLogs.length} entrée(s) importée(s)`, 'success');
    } catch(err) {
      window.UI.toast("Erreur d'import : " + err.message, 'error');
    }
  };
  reader.readAsText(file);
  this.value = '';
}

function clearAll() {
  if (!confirm('Supprimer absolument tous les cacas de Clémence ? 😱')) return;
  state.logs = [];
  saveState(state);
  renderAll();
  $debug('🧹 cleared');
}

// ===================================================
//  CONFETTI
// ===================================================
function showConfetti() {
  const emojis = ['🎉','✨','🌟','🎊','💩','🫶'];
  for (let i = 0; i < 30; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left = Math.random() * 100 + 'vw';
    el.style.animationDelay = (Math.random() * 0.4) + 's';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
}

// ===================================================
//  UTILS
// ===================================================
function textureEmoji(t) {
  return ({normal:'💩',dur:'🗿',mou:'🍮',spray:'💦',liquide:'🌊',explosif:'💥'})[t] || '💩';
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
