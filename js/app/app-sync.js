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
        state.logs.push({
          id:        p.id,
          date:      p.date,
          texture:   p.texture,
          color:     p.color,
          comment:   p.comment || '',
          isRetro:   p.is_retro,
          mood:      p.mood || null,
          updated_at: p.updated_at
        });
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
            isRetro:   p.is_retro,
            mood:      p.mood || null,
            updated_at: p.updated_at
          });
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
window.syncCloudData = syncCloudData;

// ===================================================
//  OFFLINE QUEUE  (feature 14)
// ===================================================
async function processOfflineQueue() {
  if (!window.SupabaseClient?.isLoggedIn()) return;
  const raw = localStorage.getItem('cacaTracker.offlineQueue');
  if (!raw) return;
  let queue;
  try { queue = JSON.parse(raw); } catch { return; }
  if (!queue.length) return;

  const remaining = [];
  for (const item of queue) {
    try {
      if (item.type === 'add') {
        await window.SupabaseClient.savePoopCloud(item.poop);
      } else if (item.type === 'del') {
        await window.SupabaseClient.deletePoopCloud(item.id);
      }
      $debug(`☁️ Queue: ${item.type} envoyé`);
    } catch(e) {
      $debug('queue flush err: ' + e.message);
      remaining.push(item); // réessayer plus tard
    }
  }

  if (remaining.length) {
    localStorage.setItem('cacaTracker.offlineQueue', JSON.stringify(remaining));
  } else {
    localStorage.removeItem('cacaTracker.offlineQueue');
    $debug('✅ File offline vidée — tout synchronisé');
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

function importData() {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!imported.logs || !Array.isArray(imported.logs)) {
        alert('Fichier invalide : aucun log trouvé.');
        return;
      }
      const existingIds = new Set(state.logs.map(l => String(l.id)));
      const newLogs = imported.logs.filter(l => !existingIds.has(String(l.id)));
      state.logs = [...state.logs, ...newLogs].sort((a, b) => b.date - a.date);
      saveState(state);
      renderAll();
      alert(`✅ ${newLogs.length} entrée(s) importée(s) !`);
    } catch(err) {
      alert('Erreur import : ' + err.message);
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
