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

    // CSS color values mapped from French color names
    const cssColors = {
        marron: '#92400e',
        vert: '#16a34a',
        jaune: '#d97706',
        noir: '#374151',
        rouge: '#dc2626',
        'arc-en-ciel': 'linear-gradient(90deg,#f59e0b,#ec4899,#8b5cf6)'
    };

    poops.forEach(p => {
        colorCounts[p.color] = (colorCounts[p.color] || 0) + 1;
    });

    let html = '<div class="chart-container">';
    html += '<h3>🎨 Répartition des Couleurs</h3>';
    html += '<div class="pie-chart-legend">';

    for (const [color, count] of Object.entries(colorCounts)) {
        const percentage = Math.round((count / poops.length) * 100);
        const fillStyle = cssColors[color] || '#92400e';
        html += `
            <div class="legend-item">
                <span class="legend-color">${colorEmojis[color] || '🟤'}</span>
                <span class="legend-text">${colorNames[color] || color}</span>
                <span class="legend-value">${count} (${percentage}%)</span>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%; background: ${fillStyle};"></div>
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
// 📅 Calendrier mensuel — une case par jour, comme un vrai calendrier.
// Remplace l'ancienne carte thermique annuelle : jolie de loin, mais on n'y
// lisait ni les dates ni les quantités.

const MOIS_LONGS = ['janvier','février','mars','avril','mai','juin',
                    'juillet','août','septembre','octobre','novembre','décembre'];

/** Clé 'AAAA-MM-JJ' en heure locale (toISOString décalerait d'un jour). */
function cleJour(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/**
 * Fonction pure : la grille d'un mois, décalé de `offset` mois par rapport à
 * aujourd'hui (0 = mois courant, -1 = le mois dernier).
 * Renvoie 6 semaines de 7 jours pour que la hauteur ne saute pas d'un mois
 * à l'autre, les jours voisins étant marqués `inMonth: false`.
 */
function buildMonthGrid(poops, offset = 0, now = Date.now()) {
    const counts = {};
    (poops || []).forEach(p => {
        const k = cleJour(new Date(p.date));
        counts[k] = (counts[k] || 0) + 1;
    });

    const today = new Date(now);
    const ref   = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const annee = ref.getFullYear(), mois = ref.getMonth();

    // Lundi de la semaine contenant le 1er du mois (getDay : 0 = dimanche)
    const premier = new Date(annee, mois, 1);
    const debut = new Date(premier);
    debut.setDate(1 - ((premier.getDay() + 6) % 7));

    const cleAujourdhui = cleJour(today);
    const cells = [];
    for (let i = 0; i < 42; i++) {
        const d = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + i);
        const key = cleJour(d);
        cells.push({
            key,
            day: d.getDate(),
            count: counts[key] || 0,
            inMonth: d.getMonth() === mois && d.getFullYear() === annee,
            isToday: key === cleAujourdhui,
            isFuture: d > today,
        });
    }

    const duMois = cells.filter(c => c.inMonth);
    const total  = duMois.reduce((n, c) => n + c.count, 0);
    const meilleur = duMois.reduce((best, c) => (c.count > (best?.count || 0) ? c : best), null);

    // Bornes de navigation : ni dans le futur, ni avant le tout premier caca.
    const premierCaca = (poops || []).length ? new Date(Math.min(...poops.map(p => p.date))) : today;
    const moisEcoulesDepuisDebut =
        (today.getFullYear() - premierCaca.getFullYear()) * 12 + (today.getMonth() - premierCaca.getMonth());

    return {
        annee, mois, offset,
        label: `${MOIS_LONGS[mois]} ${annee}`,
        cells,
        total,
        joursActifs: duMois.filter(c => c.count > 0).length,
        meilleur: meilleur && meilleur.count > 0 ? meilleur : null,
        peutAvancer: offset < 0,
        peutReculer: offset > -moisEcoulesDepuisDebut,
    };
}

function createMonthCalendar(poops, offset = 0) {
    const g = buildMonthGrid(poops, offset);
    const jours = ['L','M','M','J','V','S','D'];

    const cellules = g.cells.map(c => {
        if (!c.inMonth) return '<div class="cal-cell cal-out"></div>';
        const classes = ['cal-cell'];
        if (c.isToday) classes.push('cal-today');
        if (c.count > 0) classes.push('cal-done');
        if (c.isFuture) classes.push('cal-future');
        const attrs = c.count > 0
            ? `data-date="${c.key}" role="button" tabindex="0" aria-label="${c.day} ${MOIS_LONGS[g.mois]} : ${c.count} caca${c.count > 1 ? 's' : ''}"`
            : '';
        const marque = c.count === 0 ? ''
            : c.count <= 3 ? `<div class="cal-dots">${'💩'.repeat(c.count)}</div>`
            : `<div class="cal-dots">💩<span class="cal-x">×${c.count}</span></div>`;
        return `<div class="${classes.join(' ')}" ${attrs}>
                  <span class="cal-num">${c.day}</span>${marque}
                </div>`;
    }).join('');

    const resume = g.total === 0
        ? 'Aucun caca ce mois-ci'
        : `${g.total} caca${g.total > 1 ? 's' : ''} sur ${g.joursActifs} jour${g.joursActifs > 1 ? 's' : ''}` +
          (g.meilleur ? ` · record le ${g.meilleur.day} (${g.meilleur.count})` : '');

    return `
      <div class="card p-4 rounded-[1.5rem] mb-4">
        <div class="cal-head">
          <button type="button" class="cal-nav" data-cal="-1" ${g.peutReculer ? '' : 'disabled'} aria-label="Mois précédent">‹</button>
          <div class="cal-title">📅 ${g.label}</div>
          <button type="button" class="cal-nav" data-cal="1" ${g.peutAvancer ? '' : 'disabled'} aria-label="Mois suivant">›</button>
        </div>
        <div class="text-xs opacity-60 text-center mb-3">${resume}</div>
        <div class="cal-grid cal-dow">${jours.map(j => `<div>${j}</div>`).join('')}</div>
        <div class="cal-grid">${cellules}</div>
      </div>`;
}

// Mois affiché et entrées à dessiner, conservés entre deux rendus de l'onglet
// Stats. Les entrées sont passées explicitement : `state` est un `let` de
// portée lexicale dans app-core.js, il n'existe pas sur `window`.
let _calendarOffset = 0;
let _calendarLogs = [];

function renderCalendar(logs, offset) {
    const el = document.getElementById('heatmap-container');
    if (!el) return;
    if (Array.isArray(logs)) _calendarLogs = logs;
    if (typeof offset === 'number') _calendarOffset = offset;
    el.innerHTML = createMonthCalendar(_calendarLogs, _calendarOffset);

    // Délégation posée une seule fois : renderStats() repasse ici à chaque
    // affichage de l'onglet, et empilait autrefois les écouteurs.
    if (el.dataset.wired) return;
    el.dataset.wired = '1';
    el.addEventListener('click', e => {
        const nav = e.target.closest('[data-cal]');
        if (nav) { renderCalendar(null, _calendarOffset + Number(nav.dataset.cal)); return; }
        const cell = e.target.closest('[data-date]');
        if (cell && typeof showDayDetail === 'function') showDayDetail(cell.dataset.date);
    });
    el.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const cell = e.target.closest('[data-date]');
        if (cell && typeof showDayDetail === 'function') { e.preventDefault(); showDayDetail(cell.dataset.date); }
    });
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
