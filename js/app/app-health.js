// ============================================================
//  app-health.js
//  score sante, records, tendances, PDF medical, comparaison mensuelle, Bristol, anniversaires
//  Extrait du bloc <script> de index.html. L'ordre de chargement
//  est significatif : ces fichiers partagent la portee globale.
// ============================================================

// ===================================================
//  SCORE SANTÉ 🏥
// ===================================================
function renderHealthScore() {
  const el = $id('health-score-container');
  if (!el || state.logs.length < 5) { if (el) el.innerHTML = ''; return; }

  const sorted = [...state.logs].sort((a,b) => a.date - b.date);
  const intervals = [];
  for (let i = 1; i < sorted.length; i++) {
    intervals.push((sorted[i].date - sorted[i-1].date) / 3600000);
  }
  const avg = intervals.reduce((a,b) => a+b, 0) / intervals.length;
  const stdDev = Math.sqrt(intervals.map(x => Math.pow(x - avg, 2)).reduce((a,b) => a+b, 0) / intervals.length);
  const cv = avg > 0 ? stdDev / avg : 1;
  const streak = calculateStreak();

  // Grille de score
  let score = 100;
  // Intervalle idéal : 12-36h
  if (avg < 8 || avg > 72) score -= 30;
  else if (avg < 12 || avg > 48) score -= 15;
  // Régularité (coefficient de variation)
  if (cv > 0.8)      score -= 30;
  else if (cv > 0.5) score -= 15;
  else if (cv > 0.3) score -= 5;
  // Streak
  if (streak >= 7)  score += 10;
  else if (streak < 2) score -= 10;
  score = Math.max(0, Math.min(100, score));

  const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
  const gradeColor = { A:'#10b981', B:'#f59e0b', C:'#f97316', D:'#ef4444' }[grade];
  const gradeMsg   = { A:'Excellent — intestins en or !', B:'Bien — régularité correcte', C:'Moyen — pense à t\'hydrater', D:'À améliorer — consulte un médecin ?' }[grade];
  const avgH = Math.round(avg);
  const cvPct = Math.round(cv * 100);

  el.innerHTML = `
    <div class="card p-4 rounded-[1.5rem]">
      <div class="font-bold mb-3 text-sm">🏥 Score de régularité intestinale</div>
      <div class="flex items-center gap-4">
        <div class="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
             style="background:${gradeColor}">${grade}</div>
        <div class="flex-1">
          <div class="font-bold" style="color:${gradeColor}">${gradeMsg}</div>
          <div class="text-xs opacity-60 mt-1">Intervalle moyen : ${avgH}h · Variabilité : ${cvPct}% · Streak : ${streak}j</div>
          <div class="w-full rounded-full overflow-hidden mt-2" style="height:6px;background:rgba(0,0,0,0.08)">
            <div style="width:${score}%;height:100%;border-radius:99px;background:${gradeColor};transition:width .6s"></div>
          </div>
        </div>
      </div>
    </div>`;
}

// ===================================================
//  RECORDS PERSONNELS 🏅  (feature 9)
// ===================================================
function renderPersonalRecords() {
  const el = $id('records-container');
  if (!el || state.logs.length < 3) { if (el) el.innerHTML = ''; return; }

  const logs = state.logs;

  // Best single day
  const dayCounts = {};
  logs.forEach(l => {
    const k = new Date(l.date).toDateString();
    dayCounts[k] = (dayCounts[k] || 0) + 1;
  });
  const bestDay = Math.max(...Object.values(dayCounts));

  // Best streak (all time)
  const uniqueDays = [...new Set(logs.map(l => {
    const d = new Date(l.date);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }))].sort((a, b) => a - b);
  let bestStreak = 1, cur = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    if (uniqueDays[i] - uniqueDays[i-1] === 86400000) { cur++; bestStreak = Math.max(bestStreak, cur); }
    else cur = 1;
  }

  // Best week (sliding 7 days)
  let bestWeek = 0;
  const sortedDates = logs.map(l => l.date).sort((a, b) => a - b);
  for (let i = 0; i < sortedDates.length; i++) {
    const window7End = sortedDates[i] + 7 * 86400000;
    let count = 0;
    for (let j = i; j < sortedDates.length && sortedDates[j] <= window7End; j++) count++;
    bestWeek = Math.max(bestWeek, count);
  }

  // Best month
  const monthCounts = {};
  logs.forEach(l => {
    const d = new Date(l.date);
    const k = d.getFullYear() + '-' + d.getMonth();
    monthCounts[k] = (monthCounts[k] || 0) + 1;
  });
  const bestMonth = Math.max(...Object.values(monthCounts));

  // Current streak
  const curStreak = (() => {
    let s = 0;
    const today = new Date(); today.setHours(0,0,0,0);
    for (let i = 0; i < 366; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      if (dayCounts[d.toDateString()]) s++;
      else if (i > 0) break;
    }
    return s;
  })();

  const records = [
    { icon: '🔥', label: 'Streak record', value: bestStreak + ' j', sub: curStreak > 0 ? 'actuel: ' + curStreak + 'j' : '' },
    { icon: '📅', label: 'Meilleur jour', value: bestDay + ' 💩', sub: bestDay > 1 ? 'en une journée !' : '' },
    { icon: '📆', label: 'Meilleure semaine', value: bestWeek + ' 💩', sub: 'sur 7 jours glissants' },
    { icon: '🏆', label: 'Meilleur mois', value: bestMonth + ' 💩', sub: 'en un mois calendaire' },
  ];

  el.innerHTML = `
    <div class="card p-4 rounded-[1.5rem]">
      <div class="font-bold mb-3 text-sm">🏅 Tes records personnels</div>
      <div class="grid grid-cols-2 gap-3">
        ${records.map(r => `
          <div class="rounded-[1rem] p-3 text-center" style="background:color-mix(in srgb,var(--accent) 8%,transparent)">
            <div class="text-2xl mb-1">${r.icon}</div>
            <div class="text-xs opacity-60 mb-0.5">${r.label}</div>
            <div class="font-bold text-lg" style="color:var(--accent)">${r.value}</div>
            ${r.sub ? `<div class="text-xs opacity-50 mt-0.5">${r.sub}</div>` : ''}
          </div>`).join('')}
      </div>
    </div>`;
}

// ===================================================
//  TENDANCES DE SANTÉ 📈  (feature 10)
// ===================================================
function checkHealthTrends() {
  const el = $id('health-trend-banner');
  if (!el) return;

  if (state.logs.length === 0) { el.classList.add('hidden'); return; }

  const sorted = [...state.logs].sort((a, b) => b.date - a.date);
  const last   = sorted[0];
  const hoursSinceLast = last ? (Date.now() - last.date) / 3600000 : Infinity;

  // Alertes par ordre de priorité
  const alerts = [];

  // Constipation (>48h)
  if (hoursSinceLast > 48) {
    const h = Math.round(hoursSinceLast);
    alerts.push({ msg: `⚠️ ${h}h sans caca — attention à la constipation !`, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' });
  }

  // Selles liquides/explosives consécutives (≥3 dernières)
  const last3 = sorted.slice(0, 3);
  if (last3.length === 3 && last3.every(l => l.texture === 'liquide' || l.texture === 'explosif')) {
    alerts.push({ msg: '💊 3 selles liquides/explosives consécutives — hydrate-toi bien !', color: '#f97316', bg: 'rgba(249,115,22,0.1)' });
  }

  // Dures consécutives (≥3)
  if (last3.length === 3 && last3.every(l => l.texture === 'dur')) {
    alerts.push({ msg: '🪨 3 selles dures consécutives — bois plus d\'eau !', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' });
  }

  // Message positif : streak > 7 sans alerte
  if (!alerts.length) {
    const streak = (() => {
      const days = new Set(state.logs.map(l => new Date(l.date).toDateString()));
      let s = 0, today = new Date();
      for (let i = 0; i < 30; i++) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        if (days.has(d.toDateString())) s++;
        else if (i > 0) break;
      }
      return s;
    })();
    if (streak >= 7) {
      alerts.push({ msg: `🌟 ${streak} jours de suite ! Super régularité intestinale 💪`, color: '#10b981', bg: 'rgba(16,185,129,0.1)' });
    }
  }

  if (!alerts.length) { el.classList.add('hidden'); return; }

  const a = alerts[0];
  el.style.cssText = `background:${a.bg};color:${a.color};border:1.5px solid color-mix(in srgb,${a.color} 30%,transparent)`;
  el.textContent = a.msg;
  el.classList.remove('hidden');
}

// ===================================================
//  EXPORT PDF MÉDICAL 🏥  (feature 8)
// ===================================================
function exportMedicalPDF() {
  const el = $id('print-report');
  if (!el) return;

  const now = new Date();
  const logs = state.logs;
  if (!logs.length) { alert('Aucune donnée à exporter !'); return; }

  const total = logs.length;
  const sorted = [...logs].sort((a, b) => a.date - b.date);
  const firstDate = new Date(sorted[0].date).toLocaleDateString('fr');
  const lastDate  = new Date(sorted[sorted.length - 1].date).toLocaleDateString('fr');
  const days      = Math.max(1, (sorted[sorted.length - 1].date - sorted[0].date) / 86400000);
  const avgPerDay = (total / days).toFixed(2);

  const textureCounts = {};
  logs.forEach(l => { textureCounts[l.texture] = (textureCounts[l.texture] || 0) + 1; });

  const intervals = [];
  for (let i = 1; i < sorted.length; i++) intervals.push((sorted[i].date - sorted[i-1].date) / 3600000);
  const avgTransit = intervals.length ? Math.round(intervals.reduce((a,b) => a+b, 0) / intervals.length) : null;

  const textureNames = { normal:'Normal (Bristol 3-4)', dur:'Dur (Bristol 1-2)', mou:'Mou (Bristol 5)', spray:'Floconneux (Bristol 6)', liquide:'Liquide (Bristol 7)', explosif:'Explosif (Bristol 7)' };

  el.innerHTML = `
    <div class="print-section">
      <h1 style="font-size:20pt;margin-bottom:4px">📋 Rapport intestinal médical</h1>
      <p style="opacity:.6;font-size:10pt">Généré le ${now.toLocaleDateString('fr')} — Caca-Tracker 3000 Deluxe</p>
      <hr style="margin:12px 0">
      <p><strong>Période :</strong> ${firstDate} → ${lastDate}</p>
      <p><strong>Total d'entrées :</strong> ${total} selles</p>
      <p><strong>Fréquence moyenne :</strong> ${avgPerDay}/jour</p>
      ${avgTransit !== null ? `<p><strong>Transit intestinal moyen :</strong> ${avgTransit}h</p>` : ''}
      <p><strong>Tonnage estimé :</strong> ${(total * 0.15).toFixed(1)} kg</p>
    </div>
    <div class="print-section">
      <h2 style="font-size:14pt;margin-bottom:8px">Répartition selon l'Échelle de Bristol</h2>
      ${Object.entries(textureCounts).map(([t, c]) => {
        const pct = Math.round(c / total * 100);
        return `<p style="margin-bottom:6px">
          <strong>${textureNames[t] || t} :</strong> ${c} (${pct}%)
          <div class="print-bar-bg"><div class="print-bar-fill" style="width:${pct}%"></div></div>
        </p>`;
      }).join('')}
      <p style="margin-top:12px;font-size:10pt;opacity:.7">✅ Idéal médical : 75-85% Normal, moins de 5% Liquide/Explosif</p>
    </div>
    <div class="print-section">
      <h2 style="font-size:14pt;margin-bottom:8px">Note pour le médecin</h2>
      <p style="font-size:10pt;opacity:.7">Ces données ont été collectées via l'application Caca-Tracker 3000 Deluxe (enregistrement manuel). La classification des selles suit l'Échelle de Bristol (1-7). Les données sont à titre indicatif et doivent être interprétées par un professionnel de santé.</p>
    </div>`;

  window.print();
}

// ===================================================
//  COMPARAISON MENSUELLE 📆  (feature 19 — 3 colonnes)
// ===================================================
function renderMonthCompare() {
  const el = $id('month-compare-container');
  if (!el) return;
  const now = new Date();
  const thisStart  = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const lastStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const lyStart    = new Date(now.getFullYear() - 1, now.getMonth(), 1).getTime();
  const lyEnd      = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1).getTime();

  const thisCount = state.logs.filter(l => l.date >= thisStart).length;
  const lastCount = state.logs.filter(l => l.date >= lastStart && l.date < thisStart).length;
  const lyCount   = state.logs.filter(l => l.date >= lyStart && l.date < lyEnd).length;

  const delta  = thisCount - lastCount;
  const color  = delta > 0 ? '#10b981' : delta < 0 ? '#ef4444' : '#94a3b8';
  const arrow  = delta > 0 ? '↑' : delta < 0 ? '↓' : '=';
  const pct    = lastCount > 0 ? Math.round(Math.abs(delta / lastCount) * 100) : null;

  const monthNames = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  const thisMonthName = monthNames[now.getMonth()];
  const lastMonthName = monthNames[(now.getMonth() + 11) % 12];
  const lyLabel       = thisMonthName + ' ' + (now.getFullYear() - 1);

  // Barre visuelle (max des 3 pour normaliser)
  const maxVal = Math.max(thisCount, lastCount, lyCount, 1);
  function bar(count) {
    const w = Math.round((count / maxVal) * 100);
    return `<div class="w-full rounded-full overflow-hidden mt-1" style="height:4px;background:rgba(0,0,0,0.08)">
      <div style="width:${w}%;height:100%;border-radius:99px;background:var(--accent);transition:width .5s"></div></div>`;
  }

  el.innerHTML = `
    <div class="card p-4 rounded-[1.5rem]">
      <div class="font-bold mb-3 text-sm">📆 Moi vs moi-même</div>
      <div class="grid grid-cols-3 gap-2 text-center">
        <div>
          <div class="text-xs opacity-50">${lastMonthName}</div>
          <div class="text-xl font-bold">${lastCount}</div>
          ${bar(lastCount)}
        </div>
        <div>
          <div class="text-xs font-bold" style="color:var(--accent)">${thisMonthName} ✨</div>
          <div class="text-xl font-bold" style="color:var(--accent)">${thisCount}</div>
          ${bar(thisCount)}
          ${pct !== null ? `<div class="text-xs font-bold mt-1" style="color:${color}">${delta > 0 ? '+' : ''}${delta !== 0 ? (delta > 0 ? '+' : '') + pct + '%' : '='}</div>` : ''}
        </div>
        <div>
          <div class="text-xs opacity-50">${lyLabel}</div>
          <div class="text-xl font-bold opacity-70">${lyCount}</div>
          ${bar(lyCount)}
        </div>
      </div>
      ${pct !== null ? `<div class="text-center text-xs mt-3 opacity-60">${arrow} ${Math.abs(delta)} caca${Math.abs(delta) > 1 ? 's' : ''} vs le mois dernier</div>` : ''}
    </div>`;
}

// ===================================================
//  BRISTOL SCALE 🔬  (feature 17)
// ===================================================
function renderBristolScale() {
  const el = $id('bristol-container');
  if (!el || state.logs.length === 0) { if (el) el.innerHTML = ''; return; }

  const bristolLevels = [
    { num: 1, label: 'Type 1', desc: 'Petites boules dures séparées', textures: ['dur'], color: '#7c3aed', icon: '⚫⚫⚫' },
    { num: 2, label: 'Type 2', desc: 'Saucisse grumeleuse et dure',   textures: ['dur'], color: '#9c4221', icon: '🟤🟤' },
    { num: 3, label: 'Type 3', desc: 'Saucisse avec craquelures',     textures: ['normal'], color: '#d97706', icon: '🟫' },
    { num: 4, label: 'Type 4', desc: 'Saucisse lisse et molle ✅',    textures: ['normal'], color: '#10b981', icon: '💩' },
    { num: 5, label: 'Type 5', desc: 'Morceaux mous aux bords nets',  textures: ['mou'], color: '#f59e0b', icon: '🟡' },
    { num: 6, label: 'Type 6', desc: 'Pâteux, morceaux effilochés',   textures: ['spray'], color: '#f97316', icon: '💦' },
    { num: 7, label: 'Type 7', desc: 'Entièrement liquide',           textures: ['liquide','explosif'], color: '#ef4444', icon: '🌊' },
  ];

  // Compter par texture mappée sur Bristol
  const textureCounts = {};
  state.logs.forEach(l => { textureCounts[l.texture] = (textureCounts[l.texture] || 0) + 1; });

  const totalMapped = bristolLevels.reduce((sum, lvl) => {
    return sum + lvl.textures.reduce((s, t) => s + (textureCounts[t] || 0), 0);
  }, 0) || 1;

  const rows = bristolLevels.map(lvl => {
    const count = lvl.textures.reduce((s, t) => s + (textureCounts[t] || 0), 0);
    const pct   = Math.round((count / totalMapped) * 100);
    const isIdeal = lvl.num === 3 || lvl.num === 4;
    return `
      <div class="flex items-center gap-2 py-1.5" style="border-bottom:1px solid rgba(0,0,0,0.05)">
        <div class="w-6 text-center text-xs font-bold opacity-50">${lvl.num}</div>
        <div class="text-lg w-10 shrink-0 text-center">${lvl.icon}</div>
        <div class="flex-1 min-w-0">
          <div class="text-xs font-bold flex items-center gap-1">
            ${lvl.desc}
            ${isIdeal ? '<span class="text-xs px-1 rounded" style="background:rgba(16,185,129,0.15);color:#10b981">idéal</span>' : ''}
          </div>
          <div class="w-full rounded-full overflow-hidden mt-1" style="height:4px;background:rgba(0,0,0,0.07)">
            <div style="width:${pct}%;height:100%;border-radius:99px;background:${lvl.color};transition:width .5s"></div>
          </div>
        </div>
        <div class="text-xs font-bold w-10 text-right" style="color:${count > 0 ? lvl.color : 'inherit'};opacity:${count > 0 ? 1 : 0.3}">
          ${count > 0 ? count + ' (' + pct + '%)' : '—'}
        </div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="card p-4 rounded-[1.5rem]">
      <div class="font-bold mb-1 text-sm">🔬 Échelle de Bristol</div>
      <div class="text-xs opacity-50 mb-3">Classification médicale de tes ${state.logs.length} selles</div>
      ${rows}
      <div class="mt-3 p-2 rounded-xl text-xs text-center font-bold" style="background:rgba(16,185,129,0.1);color:#10b981">
        ✅ Types 3 et 4 = selles idéales selon la médecine
      </div>
    </div>`;
}

// ===================================================
//  ANNIVERSAIRES DE CACAS 🎂  (feature 18)
// ===================================================
function checkAnniversaries() {
  if (state.logs.length === 0) return null;
  const today = new Date();
  const todayMD = String(today.getMonth() + 1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
  const sorted  = [...state.logs].sort((a, b) => a.date - b.date);

  const milestones = [
    { count: 1,   emoji: '⭐', label: '1er caca enregistré' },
    { count: 10,  emoji: '🏅', label: '10ème caca' },
    { count: 50,  emoji: '🥈', label: '50ème caca' },
    { count: 100, emoji: '💯', label: '100ème caca' },
    { count: 200, emoji: '🏆', label: '200ème caca' },
    { count: 365, emoji: '🌟', label: '365ème caca' },
  ];

  for (const m of milestones) {
    if (sorted.length < m.count) continue;
    const poopDate = new Date(sorted[m.count - 1].date);
    const poopMD   = String(poopDate.getMonth() + 1).padStart(2,'0') + '-' + String(poopDate.getDate()).padStart(2,'0');
    const yearsAgo = today.getFullYear() - poopDate.getFullYear();
    if (poopMD === todayMD && yearsAgo >= 1) {
      return { emoji: m.emoji, label: m.label, yearsAgo };
    }
  }
  return null;
}
