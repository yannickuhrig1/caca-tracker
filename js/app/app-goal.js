// ============================================================
//  app-goal.js
//  objectif quotidien, compte a rebours, annee en review, partage, detail du jour
//  Extrait du bloc <script> de index.html. L'ordre de chargement
//  est significatif : ces fichiers partagent la portee globale.
// ============================================================

// ===================================================
//  OBJECTIF DU JOUR 🎯
// ===================================================
function setupGoal() {
  const stored = parseInt(localStorage.getItem('dailyGoal') || '1');
  updateGoalUI(stored);

  $id('goal-minus')?.addEventListener('click', () => {
    const v = Math.max(1, parseInt(localStorage.getItem('dailyGoal') || '1') - 1);
    localStorage.setItem('dailyGoal', v);
    updateGoalUI(v);
  });
  $id('goal-plus')?.addEventListener('click', () => {
    const v = Math.min(10, parseInt(localStorage.getItem('dailyGoal') || '1') + 1);
    localStorage.setItem('dailyGoal', v);
    updateGoalUI(v);
  });
}

function updateGoalUI(goal) {
  const goalVal = goal || parseInt(localStorage.getItem('dailyGoal') || '1');
  const today = new Date().toDateString();
  const todayCount = state.logs.filter(l => new Date(l.date).toDateString() === today).length;
  const pct = Math.min(100, Math.round((todayCount / goalVal) * 100));
  const bar = $id('goal-bar');
  const label = $id('goal-label');
  const valEl = $id('goal-value');
  if (valEl) valEl.textContent = goalVal;
  if (bar) {
    bar.style.width = pct + '%';
    bar.style.background = pct >= 100 ? '#10b981' : 'var(--accent)';
  }
  if (label) {
    label.textContent = pct >= 100
      ? `🎉 Objectif atteint ! ${todayCount} / ${goalVal} caca${goalVal > 1 ? 's' : ''}`
      : `${todayCount} / ${goalVal} caca${goalVal > 1 ? 's' : ''} aujourd'hui`;
  }
  // Streak d'objectifs
  const goalStreakEl = $id('goal-streak');
  if (goalStreakEl) {
    const gs = calculateGoalStreak(goalVal);
    goalStreakEl.textContent = gs > 0 ? `🔥 ${gs}j d'affilée` : '';
    goalStreakEl.classList.toggle('hidden', gs === 0);
  }
}

function calculateGoalStreak(goal) {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 90; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = d.toDateString();
    const count = state.logs.filter(l => new Date(l.date).toDateString() === ds).length;
    if (count >= goal) streak++;
    else break;
  }
  return streak;
}

// ===================================================
//  COMPTE À REBOURS ⏱️
// ===================================================
let _countdownInterval = null;

function startCountdown() {
  if (_countdownInterval) clearInterval(_countdownInterval);
  _countdownInterval = setInterval(tickCountdown, 60000);
  tickCountdown();
}

function tickCountdown() {
  const container = $id('countdown-container');
  const display   = $id('countdown-display');
  if (!container || !display) return;

  if (state.logs.length < 2 || typeof PredictionEngine === 'undefined') {
    container.style.display = 'none';
    return;
  }
  try {
    const pred = new PredictionEngine(state.logs).predictNextPoop();
    if (!pred || !pred.nextTime) { container.style.display = 'none'; return; }

    const diffMs = pred.nextTime - Date.now();
    if (diffMs <= 0) {
      display.textContent = 'Maintenant ? 🚨';
      container.style.display = 'flex';
      return;
    }
    const h = Math.floor(diffMs / 3600000);
    const m = Math.floor((diffMs % 3600000) / 60000);
    display.textContent = h > 0 ? `${h}h ${m}min` : `${m} min`;
    container.style.display = 'flex';
  } catch(e) {
    container.style.display = 'none';
  }
}

// ===================================================
//  ANNÉE EN REVIEW 🎬
// ===================================================
function openWrapped() {
  const modal = $id('wrapped-modal');
  const content = $id('wrapped-content');
  if (!modal || !content) return;

  const logs = state.logs;
  if (!logs.length) {
    content.innerHTML = '<div class="text-white text-center opacity-60 py-8">Ajoute des cacas pour voir ton année en review !</div>';
    modal.classList.remove('hidden');
    return;
  }

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
  const yearLogs  = logs.filter(l => l.date >= yearStart);
  const allLogs   = logs;

  // Mois le plus actif (cette année)
  const monthCounts = {};
  yearLogs.forEach(l => {
    const m = new Date(l.date).getMonth();
    monthCounts[m] = (monthCounts[m] || 0) + 1;
  });
  const bestMonthIdx = Object.entries(monthCounts).sort((a,b) => b[1]-a[1])[0];
  const monthNames = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

  // Texture préférée
  const textureCounts = {};
  allLogs.forEach(l => { textureCounts[l.texture] = (textureCounts[l.texture] || 0) + 1; });
  const favTexture = Object.entries(textureCounts).sort((a,b) => b[1]-a[1])[0];
  const textureEmoji = {normal:'💩',dur:'🗿',mou:'🍮',spray:'💦',liquide:'🌊',explosif:'💥'};

  // Heure préférée
  const hourCounts = new Array(24).fill(0);
  allLogs.forEach(l => { hourCounts[new Date(l.date).getHours()]++; });
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

  // Streak max
  const days = [...new Set(allLogs.map(l => new Date(l.date).toDateString()))].sort();
  let maxStreak = 0, curStreak = 0;
  days.forEach((d, i) => {
    if (i === 0) { curStreak = 1; }
    else {
      const prev = new Date(days[i-1]); prev.setDate(prev.getDate()+1);
      curStreak = prev.toDateString() === d ? curStreak + 1 : 1;
    }
    maxStreak = Math.max(maxStreak, curStreak);
  });

  // Jour de la semaine favori
  const dayNames = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  const dowCounts = new Array(7).fill(0);
  allLogs.forEach(l => { dowCounts[new Date(l.date).getDay()]++; });
  const bestDow = dowCounts.indexOf(Math.max(...dowCounts));

  const cards = [
    { emoji:'💩', label:'Total cette année',  value:`${yearLogs.length} cacas`, sub:`${(yearLogs.length*0.15).toFixed(1)} kg produits` },
    { emoji:'📅', label:'Mois le plus actif', value: bestMonthIdx ? `${monthNames[bestMonthIdx[0]]} (${bestMonthIdx[1]})` : '—', sub:'Mois où t\'as le plus défié la gravité' },
    { emoji: favTexture ? (textureEmoji[favTexture[0]] || '💩') : '💩', label:'Texture fav', value: favTexture ? `${favTexture[0]} (${favTexture[1]}×)` : '—', sub:'Ton style signature' },
    { emoji:'🕐', label:'Heure de prédilection', value:`${String(peakHour).padStart(2,'0')}h`, sub:'Ton horloge intestinale' },
    { emoji:'🔥', label:'Meilleur streak', value:`${maxStreak} jour${maxStreak>1?'s':''}`, sub:'Record de régularité' },
    { emoji:'📆', label:'Jour préféré', value:dayNames[bestDow], sub:'Les intestins ont leurs habitudes' },
    { emoji:'⚖️', label:'Tonnage total', value:`${(allLogs.length * 0.15).toFixed(1)} kg`, sub:`Depuis le début (${allLogs.length} cacas)` },
  ];

  content.innerHTML = cards.map(c => `
    <div class="rounded-[1.5rem] p-4 text-white" style="background:rgba(255,255,255,0.12);backdrop-filter:blur(4px)">
      <div class="text-3xl mb-1">${c.emoji}</div>
      <div class="text-xs opacity-70 uppercase tracking-widest mb-1">${c.label}</div>
      <div class="text-2xl font-bold mb-1">${c.value}</div>
      <div class="text-xs opacity-60">${c.sub}</div>
    </div>`).join('');

  modal.classList.remove('hidden');
}

// ===================================================
//  PARTAGE STATS 📤
// ===================================================
function shareStats() {
  const canvas = $id('share-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const today = new Date().toDateString();
  const todayCount = state.logs.filter(l => new Date(l.date).toDateString() === today).length;
  const total  = state.logs.length;
  const streak = calculateStreak();
  const mass   = (total * 0.15).toFixed(1);

  // Fond dégradé
  const grad = ctx.createLinearGradient(0,0,W,H);
  grad.addColorStop(0, '#d97706');
  grad.addColorStop(1, '#ec4899');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Titre
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = 'bold 72px serif';
  ctx.fillText('💩', 20, 80);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('Mes stats — Caca-Tracker 3000', 100, 50);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(new Date().toLocaleDateString('fr'), 100, 75);

  // Stats
  const stats = [
    { label: 'Aujourd\'hui', val: todayCount + ' caca' + (todayCount > 1 ? 's' : '') },
    { label: 'Total',        val: total + ' cacas' },
    { label: 'Streak',       val: '🔥 ' + streak + ' jour' + (streak > 1 ? 's' : '') },
    { label: 'Tonnage',      val: '⚖️ ' + mass + ' kg' },
  ];
  stats.forEach((s, i) => {
    const x = (i % 2) * (W/2) + 30;
    const y = 140 + Math.floor(i / 2) * 95;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.roundRect(x, y, W/2 - 50, 80, 16);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '13px sans-serif';
    ctx.fillText(s.label, x + 14, y + 24);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(s.val, x + 14, y + 60);
  });

  // Footer
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '12px sans-serif';
  ctx.fillText('caca-tracker.vercel.app', W/2 - 70, H - 12);

  // Partager ou télécharger
  canvas.toBlob(blob => {
    const file = new File([blob], 'caca-stats.png', { type: 'image/png' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      navigator.share({ title: 'Mes stats 💩', files: [file] }).catch(() => downloadCanvas(canvas));
    } else {
      downloadCanvas(canvas);
    }
  });
}

function downloadCanvas(canvas) {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'caca-stats.png';
  a.click();
}

// ===================================================
//  DÉTAIL DU JOUR 📅
// ===================================================
function showDayDetail(dateKey) {
  const modal   = $id('day-detail-modal');
  const title   = $id('day-detail-title');
  const content = $id('day-detail-content');
  if (!modal) return;

  const [year, month, day] = dateKey.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const label = d.toLocaleDateString('fr', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  if (title) title.textContent = '📅 ' + label;

  const dayLogs = state.logs.filter(l => {
    const ld = new Date(l.date);
    return ld.getFullYear() === year && ld.getMonth() === month - 1 && ld.getDate() === day;
  }).sort((a,b) => a.date - b.date);

  const textureEmoji = { normal:'💩',dur:'🗿',mou:'🍮',spray:'💦',liquide:'🌊',explosif:'💥' };
  const moodEmoji    = { normal:'😊',douloureux:'😫',urgent:'⚡',difficile:'😴' };

  content.innerHTML = dayLogs.length === 0
    ? '<div class="text-white opacity-60 text-center py-8">Aucun caca ce jour-là</div>'
    : dayLogs.map(l => {
        const t = new Date(l.date).toLocaleTimeString('fr', { hour:'2-digit', minute:'2-digit' });
        return `
          <div class="rounded-[1.25rem] p-3 text-white" style="background:rgba(255,255,255,0.12)">
            <div class="flex items-center gap-2">
              <span class="text-2xl">${textureEmoji[l.texture] || '💩'}</span>
              <div class="flex-1">
                <div class="font-bold">${l.texture} <span class="opacity-70 text-sm">à ${t}</span></div>
                <div class="text-xs opacity-70">${l.color}${l.mood ? ' · ' + (moodEmoji[l.mood] || '') + ' ' + l.mood : ''}${l.comment ? ' · ' + l.comment : ''}</div>
              </div>
            </div>
          </div>`;
      }).join('');

  modal.classList.remove('hidden');
}
