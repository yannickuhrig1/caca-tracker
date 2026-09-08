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
//  CLOUD → LOCAL SYNC
// ===================================================
async function syncCloudData() {
  if (!window.SupabaseClient?.isLoggedIn()) return;
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

    const cloudPoops = await window.SupabaseClient.getMyPoops();
    if (!cloudPoops.length) return;

    // getMyPoops() retourne { id: local_id, date, texture, ... } — pas de propriété local_id séparée
    // On utilise donc p.id qui contient déjà le timestamp local
    const localMap = new Map(state.logs.map(l => [String(l.id), l]));
    let changed = 0;

    for (const p of cloudPoops) {
      const key = String(p.id); // p.id = local_id (timestamp) tel que mappé par getMyPoops()
      if (!localMap.has(key)) {
        state.logs.push(applyPoopMapFields({
          id:        p.id,
          date:      p.date,
          texture:   p.texture,
          color:     p.color,
          comment:   p.comment || '',
          isRetro:   p.isRetro,
          mood:      p.mood || null,
          updated_at: p.updated_at
        }, p));
        changed++;
      } else {
        const local = localMap.get(key);
        const cloudUpdAt = p.updated_at || 0;
        const localUpdAt = local.updated_at || 0;
        if (cloudUpdAt > localUpdAt) {
          Object.assign(local, {
            date:      p.date,
            texture:   p.texture,
            color:     p.color,
            comment:   p.comment || '',
            isRetro:   p.isRetro,
            mood:      p.mood || null,
            updated_at: p.updated_at
          });
          applyPoopMapFields(local, p);
          changed++;
        }
      }
    }

    if (changed > 0) {
      state.logs.sort((a, b) => b.date - a.date);
      saveState(state);
      renderAll();
      $debug(`☁️ ${changed} entrée(s) synchronisée(s) depuis le cloud`);
    }
  } catch(e) {
    $debug('cloud sync err: ' + e.message);
  }
}
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

window.syncCloudData = syncCloudData;

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
                'lieu', 'latitude', 'longitude', 'en_retard', 'note'];
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
