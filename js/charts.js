// 📊 Graphiques simples sans bibliothèque externe

// Créneaux de 2 h : 24 barres de 14 px sur un téléphone, personne ne les lit.
// Douze lignes horizontales, en revanche, portent leur étiquette en clair.
function buildHourSlots(poops) {
    const slots = Array.from({ length: 12 }, (_, i) => ({
        debut: i * 2,
        label: `${String(i * 2).padStart(2, '0')}–${String(i * 2 + 2).padStart(2, '0')} h`,
        count: 0,
    }));
    (poops || []).forEach(p => { slots[Math.floor(new Date(p.date).getHours() / 2)].count++; });

    const total = slots.reduce((n, s) => n + s.count, 0);
    const max   = Math.max(...slots.map(s => s.count), 0);
    // Le pic est l'information que l'on cherche : on le met en avant plutôt
    // que de teinter les douze barres selon leur valeur.
    const pic = total ? slots.reduce((a, b) => (b.count > a.count ? b : a)) : null;
    return { slots, total, max, pic };
}

function createHourlyChart(poops) {
    if (!poops || poops.length === 0) return '';
    const { slots, total, max, pic } = buildHourSlots(poops);

    const lignes = slots.map(s => {
        const pct = max ? (s.count / max) * 100 : 0;
        const estPic = pic && s.debut === pic.debut && s.count > 0;
        return `
        <div class="hb-row" title="${s.label} : ${s.count} caca${s.count > 1 ? 's' : ''}">
          <div class="hb-label${estPic ? ' hb-label-peak' : ''}">${s.label}</div>
          <div class="hb-track"><div class="hb-fill${estPic ? ' hb-peak' : ''}" style="width:${pct}%"></div></div>
          <div class="hb-value">${s.count || ''}</div>
        </div>`;
    }).join('');

    const chapeau = pic && pic.count
        ? `Ton pic : <strong>${pic.label}</strong> — ${pic.count} caca${pic.count > 1 ? 's' : ''}
           (${Math.round(pic.count / total * 100)} % du total)`
        : 'Pas encore assez de données';

    return `
      <div class="chart-card">
        <div class="chart-title">🕒 Heures de prédilection</div>
        <div class="chart-sub">${chapeau}</div>
        <div class="hb-chart">${lignes}</div>
      </div>`;
}

// Couleurs et textures : deux parts-de-tout. Les couleurs portent leur propre
// identité (c'est la donnée elle-même), les textures restent sur la teinte du
// thème — un dégradé par valeur ne dirait rien de plus que la longueur.
const COULEURS_META = {
    marron:        { label: 'Marron',      emoji: '🟤', css: '#92400e' },
    jaune:         { label: 'Jaune',       emoji: '🟡', css: '#d97706' },
    vert:          { label: 'Vert',        emoji: '🟢', css: '#16a34a' },
    noir:          { label: 'Noir',        emoji: '⚫', css: '#374151' },
    rouge:         { label: 'Rouge',       emoji: '🔴', css: '#dc2626' },
    'arc-en-ciel': { label: 'Arc-en-ciel', emoji: '🌈', css: 'linear-gradient(90deg,#f59e0b,#ec4899,#8b5cf6)' },
};

const TEXTURES_META = {
    normal:   { label: 'Normal',   emoji: '💩' },
    dur:      { label: 'Dur',      emoji: '🗿' },
    mou:      { label: 'Mou',      emoji: '🍮' },
    spray:    { label: 'Spray',    emoji: '💦' },
    liquide:  { label: 'Liquide',  emoji: '🌊' },
    explosif: { label: 'Explosif', emoji: '💥' },
};

/** Part de chaque valeur, de la plus fréquente à la moins fréquente. */
function buildShare(poops, champ, meta) {
    const counts = {};
    (poops || []).forEach(p => { const v = p[champ]; if (v) counts[v] = (counts[v] || 0) + 1; });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return Object.entries(counts)
        .map(([cle, count]) => ({
            cle, count,
            pct: total ? Math.round(count / total * 100) : 0,
            label: meta[cle]?.label || cle,
            emoji: meta[cle]?.emoji || '',
            css: meta[cle]?.css,
        }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function shareRows(parts) {
    return parts.map(p => `
        <div class="hb-row" title="${p.label} : ${p.count} (${p.pct} %)">
          <div class="hb-label">${p.emoji} ${p.label}</div>
          <div class="hb-track"><div class="hb-fill" style="width:${p.pct}%${p.css ? `;background:${p.css}` : ''}"></div></div>
          <div class="hb-value">${p.pct} %</div>
        </div>`).join('');
}

function createColorChart(poops) {
    if (!poops || poops.length === 0) return '';
    const parts = buildShare(poops, 'color', COULEURS_META);
    return `
      <div class="chart-card">
        <div class="chart-title">🎨 Répartition des couleurs</div>
        <div class="chart-sub">${parts.length} couleur${parts.length > 1 ? 's' : ''} utilisée${parts.length > 1 ? 's' : ''}
          sur ${Object.keys(COULEURS_META).length}</div>
        <div class="hb-chart">${shareRows(parts)}</div>
      </div>`;
}

function createConsistencyChart(poops) {
    if (!poops || poops.length === 0) return '';
    const parts = buildShare(poops, 'texture', TEXTURES_META);
    const normal = parts.find(p => p.cle === 'normal');
    return `
      <div class="chart-card">
        <div class="chart-title">💩 Répartition des textures</div>
        <div class="chart-sub">${normal ? `${normal.pct} % de « normal »` : 'Aucune texture normale pour l\'instant'}</div>
        <div class="hb-chart">${shareRows(parts)}</div>
      </div>`;
}

// Sept colonnes : assez peu pour rester lisibles à la verticale, à condition
// d'étiqueter chaque barre et de mettre le jour record en avant.
function buildWeekdayBars(poops) {
    const noms = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const bars = noms.map((label, i) => ({ label, jour: i, count: 0 }));
    (poops || []).forEach(p => {
        // getDay : 0 = dimanche. La semaine française commence le lundi.
        const d = new Date(p.date).getDay();
        bars[(d + 6) % 7].count++;
    });
    const max = Math.max(...bars.map(b => b.count), 0);
    const total = bars.reduce((n, b) => n + b.count, 0);
    const record = total ? bars.reduce((a, b) => (b.count > a.count ? b : a)) : null;
    return { bars, max, total, record };
}

function createWeekdayChart(poops) {
    if (!poops || poops.length === 0) return '';
    const { bars, max, total, record } = buildWeekdayBars(poops);

    const colonnes = bars.map(b => {
        const h = max ? Math.max(4, (b.count / max) * 100) : 4;
        const estRecord = record && b.jour === record.jour && b.count > 0;
        return `
        <div class="vb-col" title="${b.label} : ${b.count} caca${b.count > 1 ? 's' : ''}">
          <div class="vb-value">${b.count}</div>
          <div class="vb-track"><div class="vb-fill${estRecord ? ' vb-peak' : ''}" style="height:${h}%"></div></div>
          <div class="vb-label${estRecord ? ' vb-label-peak' : ''}">${b.label}</div>
        </div>`;
    }).join('');

    const moyenne = total / 7;
    return `
      <div class="chart-card">
        <div class="chart-title">📆 Fréquence par jour de la semaine</div>
        <div class="chart-sub">${record ? `Ton jour fort : <strong>${record.label}</strong>` : ''} ·
          moyenne ${moyenne.toFixed(1)} par jour de semaine</div>
        <div class="vb-chart">${colonnes}</div>
      </div>`;
}

// Une évolution dans le temps se lit sur une ligne, pas sur des barres
// détachées : on trace une aire + une ligne de 2 px sur les 12 derniers mois.
function buildMonthlyTrend(poops, now = Date.now()) {
    const MOIS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    const ref = new Date(now);
    const points = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
        points.push({
            annee: d.getFullYear(),
            mois: d.getMonth(),
            label: MOIS[d.getMonth()],
            titre: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
            count: 0,
        });
    }
    const index = new Map(points.map((p, i) => [`${p.annee}-${p.mois}`, i]));
    (poops || []).forEach(p => {
        const d = new Date(p.date);
        const i = index.get(`${d.getFullYear()}-${d.getMonth()}`);
        if (i !== undefined) points[i].count++;
    });

    const max = Math.max(...points.map(p => p.count), 1);
    const dernier = points[points.length - 1];
    const avant   = points[points.length - 2];

    // Le mois en cours n'est pas terminé : le comparer à un mois complet
    // afficherait une chute spectaculaire tous les 1ers du mois. On compare
    // donc à la même portion du mois précédent — même nombre de jours écoulés.
    const jourCourant = ref.getDate();
    let referenceAvant = 0;
    if (avant) {
        referenceAvant = (poops || []).filter(p => {
            const d = new Date(p.date);
            return d.getFullYear() === avant.annee && d.getMonth() === avant.mois && d.getDate() <= jourCourant;
        }).length;
    }

    return {
        points, max, dernier, avant,
        jourCourant,
        referenceAvant,
        variation: avant && referenceAvant
            ? Math.round((dernier.count - referenceAvant) / referenceAvant * 100)
            : null,
    };
}

function createMonthlyTrendChart(poops, now = Date.now()) {
    if (!poops || poops.length === 0) return '';
    const { points, max, variation } = buildMonthlyTrend(poops, now);

    const W = 320, H = 110, PAD = 6;
    const x = i => PAD + i * ((W - PAD * 2) / (points.length - 1));
    const y = v => H - PAD - (v / max) * (H - PAD * 2);

    const ligne = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.count).toFixed(1)}`).join(' ');
    const aire  = `${ligne} L${x(points.length - 1).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`;

    const marqueurs = points.map((p, i) => `
        <circle cx="${x(i).toFixed(1)}" cy="${y(p.count).toFixed(1)}" r="4"
                class="tr-dot" tabindex="0" role="img"
                aria-label="${p.titre} : ${p.count} caca${p.count > 1 ? 's' : ''}">
          <title>${p.titre} : ${p.count} caca${p.count > 1 ? 's' : ''}</title>
        </circle>`).join('');

    const etiquettes = points.map((p, i) =>
        `<div class="tr-label${i === points.length - 1 ? ' tr-label-now' : ''}">${p.label}</div>`).join('');

    // On dit explicitement à quoi on compare, sinon le chiffre ment par omission.
    const repere = 'vs le mois dernier à la même date';
    const tendance = variation === null ? ''
        : variation > 0 ? `<span class="tr-up">▲ +${variation} %</span> ${repere}`
        : variation < 0 ? `<span class="tr-down">▼ ${variation} %</span> ${repere}`
        : `stable ${repere}`;

    return `
      <div class="chart-card">
        <div class="chart-title">📈 Tendance sur 12 mois</div>
        <div class="chart-sub">Maximum ${max} dans un mois${tendance ? ' · ' + tendance : ''}</div>
        <svg class="tr-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
             aria-label="Nombre de cacas par mois sur les douze derniers mois">
          <path d="${aire}" class="tr-area"/>
          <path d="${ligne}" class="tr-line"/>
          ${marqueurs}
        </svg>
        <div class="tr-axis">${etiquettes}</div>
      </div>`;
}

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
    // L'onglet Stats porte déjà son titre : une deuxième en-tête ne servait
    // qu'à pousser les graphiques plus bas.
    return [
        createHourlyChart(poops),
        createWeekdayChart(poops),
        createMonthlyTrendChart(poops),
        createConsistencyChart(poops),
        createColorChart(poops),
    ].join('');
}
