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
