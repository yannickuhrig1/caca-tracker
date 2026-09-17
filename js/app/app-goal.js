// ============================================================
//  app-goal.js
//  objectif quotidien, compte a rebours, detail du jour
//  (annee en review et partage : app-wrapped.js depuis v2.18.0)
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
