// 📊 Graphiques simples sans bibliothèque externe

// Graphique des heures préférées
function createHourlyChart(poops) {
    if (poops.length === 0) return '';
    
    // Compte par heure
    const hourCounts = new Array(24).fill(0);
    poops.forEach(p => {
        const hour = new Date(p.date).getHours();
        hourCounts[hour]++;
    });
    
    const maxCount = Math.max(...hourCounts);
    
    let html = '<div class="chart-container">';
    html += '<h3>🕒 Heures Préférées</h3>';
    html += '<div class="bar-chart">';
    
    for (let hour = 0; hour < 24; hour++) {
        const count = hourCounts[hour];
        const heightPercent = maxCount > 0 ? (count / maxCount) * 100 : 0;
        const label = `${String(hour).padStart(2, '0')}h`;
        
        html += `
            <div class="bar-wrapper" title="${label}: ${count} cacas">
                <div class="bar" style="height: ${heightPercent}%">
                    <span class="bar-value">${count > 0 ? count : ''}</span>
                </div>
                <div class="bar-label">${hour % 4 === 0 ? label : ''}</div>
            </div>
        `;
    }
    
    html += '</div></div>';
    return html;
}

// Graphique des couleurs
function createColorChart(poops) {
    if (poops.length === 0) return '';
    
    const colorCounts = {};
    const colorNames = {
        marron: 'Marron',
        vert: 'Vert',
        jaune: 'Jaune',
        noir: 'Noir',
        rouge: 'Rouge',
        'arc-en-ciel': 'Arc-en-ciel'
    };

    const colorEmojis = {
        marron: '🟤',
        vert: '🟢',
        jaune: '🟡',
        noir: '⚫',
        rouge: '🔴',
        'arc-en-ciel': '🌈'
    };
    
    poops.forEach(p => {
        colorCounts[p.color] = (colorCounts[p.color] || 0) + 1;
    });
    
    let html = '<div class="chart-container">';
    html += '<h3>🎨 Répartition des Couleurs</h3>';
    html += '<div class="pie-chart-legend">';
    
    for (const [color, count] of Object.entries(colorCounts)) {
        const percentage = Math.round((count / poops.length) * 100);
        html += `
            <div class="legend-item">
                <span class="legend-color">${colorEmojis[color] || '🟤'}</span>
                <span class="legend-text">${colorNames[color] || color}</span>
                <span class="legend-value">${count} (${percentage}%)</span>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%; background-color: ${color};"></div>
                </div>
            </div>
        `;
    }
    
    html += '</div></div>';
    return html;
}

// Graphique de la consistance
function createConsistencyChart(poops) {
    if (poops.length === 0) return '';
    
    const consistencyCounts = {};
    const consistencyNames = {
        normal: '💩 Normal',
        dur: '🗿 Dur',
        mou: '🍮 Mou',
        spray: '💦 Spray',
        liquide: '🌊 Liquide',
        explosif: '💥 Explosif'
    };

    poops.forEach(p => {
        consistencyCounts[p.texture] = (consistencyCounts[p.texture] || 0) + 1;
    });
    
    let html = '<div class="chart-container">';
    html += '<h3>📈 Consistance</h3>';
    html += '<div class="pie-chart-legend">';
    
    for (const [consistency, count] of Object.entries(consistencyCounts)) {
        const percentage = Math.round((count / poops.length) * 100);
        html += `
            <div class="legend-item">
                <span class="legend-text">${consistencyNames[consistency] || consistency}</span>
                <span class="legend-value">${count} (${percentage}%)</span>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%;"></div>
                </div>
            </div>
        `;
    }
    
    html += '</div></div>';
    return html;
}

// Graphique de fréquence par jour de la semaine
function createWeekdayChart(poops) {
    if (poops.length === 0) return '';
    
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const dayCounts = new Array(7).fill(0);
    
    poops.forEach(p => {
        const day = new Date(p.date).getDay();
        dayCounts[day]++;
    });
    
    const maxCount = Math.max(...dayCounts);
    
    let html = '<div class="chart-container">';
    html += '<h3>📅 Fréquence par Jour</h3>';
    html += '<div class="bar-chart weekday-chart">';
    
    for (let i = 0; i < 7; i++) {
        const count = dayCounts[i];
        const heightPercent = maxCount > 0 ? (count / maxCount) * 100 : 0;
        
        html += `
            <div class="bar-wrapper" title="${days[i]}: ${count} cacas">
                <div class="bar" style="height: ${heightPercent}%">
                    <span class="bar-value">${count}</span>
                </div>
                <div class="bar-label">${days[i]}</div>
            </div>
        `;
    }
    
    html += '</div></div>';
    return html;
}

// Graphique d'évolution mensuelle
function createMonthlyTrendChart(poops) {
    if (poops.length === 0) return '';
    
    const monthCounts = {};
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    
    poops.forEach(p => {
        const date = new Date(p.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthCounts[key] = (monthCounts[key] || 0) + 1;
    });
    
    const sortedMonths = Object.keys(monthCounts).sort().slice(-6); // Derniers 6 mois
    const maxCount = Math.max(...sortedMonths.map(m => monthCounts[m]));
    
    let html = '<div class="chart-container">';
    html += '<h3>📊 Tendance Mensuelle</h3>';
    html += '<div class="line-chart">';
    
    sortedMonths.forEach((monthKey, i) => {
        const [year, month] = monthKey.split('-');
        const count = monthCounts[monthKey];
        const heightPercent = maxCount > 0 ? (count / maxCount) * 100 : 0;
        const label = `${monthNames[parseInt(month) - 1]}`;
        
        html += `
            <div class="bar-wrapper" title="${label} ${year}: ${count} cacas">
                <div class="bar trend-bar" style="height: ${heightPercent}%">
                    <span class="bar-value">${count}</span>
                </div>
                <div class="bar-label">${label}</div>
            </div>
        `;
    });
    
    html += '</div></div>';
    return html;
}

// ============================================================
// 📅 Heatmap calendrier (12 derniers mois, style GitHub)
// ============================================================
function createHeatmap(poops) {
    if (!poops || poops.length === 0) return '';

    // Construire un dictionnaire { 'YYYY-MM-DD': count }
    const counts = {};
    poops.forEach(p => {
        const d = new Date(p.date);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        counts[key] = (counts[key] || 0) + 1;
    });

    // Plage : 365 jours en arrière depuis aujourd'hui
    const today = new Date();
    today.setHours(0,0,0,0);
    const startDay = new Date(today);
    startDay.setDate(today.getDate() - 364);
    // Reculer au lundi précédent
    const dow = startDay.getDay(); // 0=Sun
    startDay.setDate(startDay.getDate() - (dow === 0 ? 6 : dow - 1));

    // Générer les semaines (colonnes) × 7 jours (lignes)
    const weeks = [];
    let cursor = new Date(startDay);
    while (cursor <= today) {
        const week = [];
        for (let d = 0; d < 7; d++) {
            if (cursor <= today) {
                const key = `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(cursor.getDate()).padStart(2,'0')}`;
                week.push({ date: new Date(cursor), count: counts[key] || 0, key });
            } else {
                week.push(null);
            }
            cursor.setDate(cursor.getDate() + 1);
        }
        weeks.push(week);
    }

    // Labels des mois (au-dessus des colonnes)
    const monthNames = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
    let monthLabels = '<div class="hm-months">';
    let lastMonth = -1;
    weeks.forEach((week, wi) => {
        const firstDay = week.find(Boolean);
        if (!firstDay) return;
        const m = firstDay.date.getMonth();
        if (m !== lastMonth) {
            monthLabels += `<span style="grid-column:${wi+1}">${monthNames[m]}</span>`;
            lastMonth = m;
        }
    });
    monthLabels += '</div>';

    // Grille de cellules
    let cells = '';
    const maxCount = Math.max(...Object.values(counts), 1);
    weeks.forEach(week => {
        cells += '<div class="hm-col">';
        week.forEach(day => {
            if (!day) { cells += '<div class="hm-cell hm-empty"></div>'; return; }
            const intensity = day.count === 0 ? 0
                : day.count === 1 ? 1
                : day.count <= 2 ? 2
                : day.count <= 3 ? 3 : 4;
            const label = `${day.key} : ${day.count} caca${day.count > 1 ? 's' : ''}`;
            const clickable = day.count > 0 ? `data-date="${day.key}" style="cursor:pointer"` : '';
            cells += `<div class="hm-cell hm-c${intensity}" title="${label}" ${clickable}></div>`;
        });
        cells += '</div>';
    });

    const total = poops.length;
    const activeDays = Object.keys(counts).length;

    return `
      <div class="card p-4 rounded-[1.5rem] mb-4">
        <div class="font-bold mb-1">📅 Calendrier des cacas</div>
        <div class="text-xs opacity-60 mb-3">${total} cacas sur ${activeDays} jours actifs</div>
        <div class="hm-wrap">
          ${monthLabels}
          <div class="hm-days-label">
            <span>Lun</span><span></span><span>Mer</span><span></span><span>Ven</span><span></span><span>Dim</span>
          </div>
          <div class="hm-grid">${cells}</div>
        </div>
        <div class="hm-legend">
          <span class="text-xs opacity-60">Moins</span>
          <div class="hm-cell hm-c0"></div>
          <div class="hm-cell hm-c1"></div>
          <div class="hm-cell hm-c2"></div>
          <div class="hm-cell hm-c3"></div>
          <div class="hm-cell hm-c4"></div>
          <span class="text-xs opacity-60">Plus</span>
        </div>
      </div>`;
}

// Crée tous les graphiques
function createAllCharts(poops) {
    let html = '<div class="charts-section">';
    html += '<h2>📊 Statistiques Avancées</h2>';
    html += createHourlyChart(poops);
    html += createWeekdayChart(poops);
    html += createColorChart(poops);
    html += createConsistencyChart(poops);
    html += createMonthlyTrendChart(poops);
    html += '</div>';
    return html;
}
