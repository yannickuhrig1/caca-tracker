// ============================================================
//  app-badges.js
//  catalogue des badges et logique de deblocage
//  Extrait du bloc <script> de index.html. L'ordre de chargement
//  est significatif : ces fichiers partagent la portee globale.
// ============================================================

// ===================================================
//  BADGES
// ===================================================
const BADGE_DEFS = [
  // ── Originals ──────────────────────────────────────────────
  { id:'first',        icon:'⭐', label:'Première Étoile',         desc:'1er caca enregistré',               color:'#eab308' },
  { id:'streak3',      icon:'🔥', label:'Flamme x3',               desc:'3 jours d\'affilée',                color:'#ef4444' },
  { id:'rainbow',      icon:'🌈', label:'Arc‑en‑Ciel',             desc:'Couleur arc-en-ciel utilisée',      color:'#8b5cf6' },
  { id:'veteran',      icon:'🏆', label:'Vétéran',                 desc:'10 cacas au total',                 color:'#f59e0b' },
  { id:'retro',        icon:'⏪', label:'Archiviste',              desc:'1 caca en retard saisi',            color:'#7c3aed' },
  { id:'frenchie',     icon:'🇫🇷',label:'À la Française',         desc:'≥ 1.1/j sur 7 jours',              color:'#3b82f6' },
  { id:'centenaire',   icon:'💯', label:'Centenaire',              desc:'100 cacas',                         color:'#059669' },
  { id:'nightcaca',    icon:'🌙', label:'Caca de nuit',            desc:'Caca entre minuit et 5h',           color:'#1e293b' },
  // ── Streak badges ─────────────────────────────────────────
  { id:'streak5',      icon:'🔥', label:'En Feu !',               desc:'5 jours d\'affilée',                color:'#f97316' },
  { id:'streak7',      icon:'⚡', label:'Semaine Parfaite',        desc:'7 jours d\'affilée',                color:'#eab308' },
  { id:'streak14',     icon:'🌟', label:'Deux Semaines',           desc:'14 jours d\'affilée',               color:'#a855f7' },
  { id:'streak30',     icon:'👑', label:'Mois de Feu',             desc:'30 jours d\'affilée',               color:'#ec4899' },
  // ── Volume ────────────────────────────────────────────────
  { id:'poops25',      icon:'🥈', label:'Argent',                  desc:'25 cacas',                          color:'#94a3b8' },
  { id:'poops50',      icon:'🥇', label:'Or Massif',               desc:'50 cacas',                          color:'#d97706' },
  { id:'poops200',     icon:'💎', label:'Diamant',                  desc:'200 cacas',                         color:'#38bdf8' },
  { id:'poops365',     icon:'🌟', label:'Légende',                  desc:'365 cacas',                         color:'#f59e0b' },
  { id:'poops500',     icon:'🚀', label:'Astronaute',              desc:'500 cacas',                         color:'#6366f1' },
  { id:'poops1000',    icon:'🌌', label:'Galactique',              desc:'1000 cacas',                        color:'#0ea5e9' },
  // ── Time of day ───────────────────────────────────────────
  { id:'earlyBird',    icon:'🐦', label:'Lève-Tôt',               desc:'Caca avant 7h du matin',            color:'#fbbf24' },
  { id:'morningPerson',icon:'☀️', label:'Matinalière',             desc:'10 cacas avant 8h',                 color:'#fb923c' },
  { id:'afterLunch',   icon:'🌤️', label:'Sieste Digestive',       desc:'5 cacas entre 12h et 14h',          color:'#34d399' },
  { id:'eveningCaca',  icon:'🌆', label:'Soirée Tranquille',       desc:'5 cacas entre 18h et 21h',          color:'#818cf8' },
  { id:'nightOwl5',    icon:'🦉', label:'Hibou',                   desc:'5 cacas entre minuit et 5h',        color:'#7c3aed' },
  { id:'earlyMorning', icon:'🌅', label:'L\'Aube',                 desc:'Caca avant 6h du matin',            color:'#f472b6' },
  // ── Multi dans la même journée ────────────────────────────
  { id:'double',       icon:'🎯', label:'Double Dose',             desc:'2 cacas le même jour',              color:'#22d3ee' },
  { id:'triple',       icon:'🎰', label:'Triple',                  desc:'3 cacas le même jour',              color:'#a3e635' },
  { id:'quad',         icon:'🎳', label:'Quadruplé',               desc:'4 cacas le même jour',              color:'#fb7185' },
  { id:'volcano',      icon:'🌋', label:'Volcan',                  desc:'5 cacas le même jour',              color:'#ef4444' },
  // ── Jours de la semaine ───────────────────────────────────
  { id:'mondayBlues',  icon:'😫', label:'Le Lundi ça part vite',   desc:'Caca un lundi',                     color:'#6b7280' },
  { id:'weekendW',     icon:'🎉', label:'Weekend Warrior',         desc:'5 cacas au total le weekend',        color:'#f59e0b' },
  { id:'fridayFun',    icon:'🕺', label:'TGIF',                    desc:'Caca un vendredi soir (≥ 18h)',      color:'#84cc16' },
  // ── Textures ──────────────────────────────────────────────
  { id:'allTextures',  icon:'🎨', label:'Artiste Complète',        desc:'Toutes les textures utilisées',     color:'#c084fc' },
  { id:'softie',       icon:'💧', label:'Toute Douce',             desc:'10 cacas mous',                     color:'#38bdf8' },
  { id:'hardRock',     icon:'🪨', label:'Dure à Cuire',            desc:'5 cacas durs',                      color:'#78716c' },
  { id:'normalNormal', icon:'💪', label:'Bien Réglée',             desc:'20 cacas normaux',                  color:'#10b981' },
  { id:'explosive',    icon:'💥', label:'Explosive',               desc:'5 cacas explosifs',                 color:'#dc2626' },
  // ── Couleurs ──────────────────────────────────────────────
  { id:'colorCollect', icon:'🎨', label:'Chasseuse de Couleurs',   desc:'5 couleurs différentes utilisées',  color:'#ec4899' },
  { id:'allColors',    icon:'🖌️', label:'Tableau de Maître',       desc:'Toutes les couleurs utilisées',     color:'#8b5cf6' },
  { id:'brownMaster',  icon:'🟤', label:'Classique',               desc:'20 cacas marrons',                  color:'#92400e' },
  { id:'greenPower',   icon:'💚', label:'Végétarienne ?',          desc:'5 cacas verts',                     color:'#16a34a' },
  // ── Vitesse ───────────────────────────────────────────────
  { id:'speedRunner',  icon:'⚡', label:'Speed Run',               desc:'3 cacas en moins de 12h',           color:'#facc15' },
  { id:'ultraSpeed',   icon:'🌪️', label:'Tornade',                 desc:'4 cacas en moins de 8h',            color:'#06b6d4' },
  { id:'sigma',        icon:'😎', label:'Sigma',                   desc:'2 cacas en moins d\'1h',            color:'#1e293b' },
  // ── Commentaires & humeur ─────────────────────────────────
  { id:'journaliste',  icon:'📝', label:'Journaliste',             desc:'1er commentaire ajouté',            color:'#0ea5e9' },
  { id:'philosopher',  icon:'🤔', label:'Philosophe',              desc:'10 commentaires',                   color:'#6366f1' },
  { id:'novelist',     icon:'📚', label:'Romancière',              desc:'30 commentaires',                   color:'#a855f7' },
  { id:'moodStart',    icon:'😊', label:'En Mode Mood',            desc:'Première humeur enregistrée',       color:'#f472b6' },
  { id:'allMoods',     icon:'🎭', label:'Actrice',                 desc:'Toutes les humeurs utilisées',      color:'#c084fc' },
  // ── Spéciaux ──────────────────────────────────────────────
  { id:'worldChamp',   icon:'🌍', label:'Championne Mondiale',     desc:'Dépasse la moyenne mondiale (1.4/j)',color:'#059669' },
  { id:'retroMaster',  icon:'⏰', label:'Archiviste Pro',          desc:'5 cacas en retard saisis',          color:'#7c3aed' },
  { id:'consistent',   icon:'📅', label:'Comme une Horloge',       desc:'Même heure ±2h pendant 5 jours',   color:'#0284c7' },
  { id:'comeback',     icon:'🔄', label:'Le Grand Retour',         desc:'Revenir après 7 jours sans caca',   color:'#64748b' },
  { id:'veteran50',    icon:'🎖️', label:'50 Jours',               desc:'50 jours depuis le 1er caca',       color:'#78716c' },
  { id:'veteran100',   icon:'🏅', label:'100 Jours',              desc:'100 jours depuis le 1er caca',       color:'#d97706' },
  { id:'anniversary',  icon:'🎂', label:'Joyeux Anniversaire !',   desc:'1 an depuis le 1er caca',           color:'#ec4899' },
  { id:'bingo',        icon:'🎱', label:'Bingo 42',                desc:'Le 42ème caca (Easter Egg)',        color:'#1e293b' },
  { id:'lucky7',       icon:'🎲', label:'Lucky 7',                 desc:'7 cacas un 7 du mois',              color:'#16a34a' },
  { id:'midnight',     icon:'🕛', label:'Minuit',                  desc:'Caca entre 23h et 1h',              color:'#312e81' },
  { id:'allWeekDays',  icon:'🗓️', label:'Toute la Semaine',       desc:'Caca chaque jour lun→dim',          color:'#0891b2' },
  // ── PoopMap 🗺️ ────────────────────────────────────────────
  { id:'explorer',     icon:'🧭', label:'Exploratrice',            desc:'3 lieux différents utilisés',       color:'#0ea5e9' },
  { id:'globetrotter', icon:'🌍', label:'Globe-trotteuse',         desc:'Les 8 lieux utilisés',              color:'#7c3aed' },
  { id:'casaniere',    icon:'🏠', label:'Casanière',               desc:'20 cacas à la maison',              color:'#f59e0b' },
  // ── Conquête 🏴 (dans l'esprit de PoopMap) ────────────────
  { id:'firstDrop',    icon:'📍', label:'Première Conquête',       desc:'1er caca géolocalisé',              color:'#ef4444' },
  { id:'cartographe',  icon:'🧭', label:'Cartographe',             desc:'10 spots différents sur la carte',  color:'#0ea5e9' },
  { id:'touriste',     icon:'🏙️', label:'Touriste',                desc:'3 communes conquises',              color:'#8b5cf6' },
  { id:'roadtrip',     icon:'🚗', label:'Roadtrip',                desc:'3 régions conquises',               color:'#f97316' },
  { id:'passeport',    icon:'🛂', label:'Passeport Tamponné',      desc:'2 pays conquis',                    color:'#22c55e' },
  { id:'aventuriere',  icon:'🥾', label:'Aventurière',             desc:'Un caca à plus de 50 km du QG',     color:'#a16207' },
  { id:'longCourrier', icon:'✈️', label:'Long-Courrier',           desc:'Un caca à plus de 500 km du QG',    color:'#6366f1' },
  { id:'pleineNature', icon:'🏕️', label:'Pleine Nature',           desc:'Un caca géolocalisé en pleine nature', color:'#16a34a' },
  // ── Durée et santé ⏱️ (v2.18.0) ───────────────────────────
  { id:'chrono',       icon:'⏱️', label:'Chronométreuse',          desc:'1re séance chronométrée',           color:'#0ea5e9' },
  { id:'express',      icon:'🏃', label:'Express',                 desc:'5 séances de moins de 2 min',       color:'#22c55e' },
  { id:'marathon',     icon:'📖', label:'Marathon',                desc:'Une séance de 15 min ou plus',      color:'#a855f7' },
  { id:'carnet',       icon:'🩺', label:'Carnet de Santé',         desc:'Contexte noté sur 10 cacas',        color:'#ef4444' },
  { id:'hydratee',     icon:'💧', label:'Bien Hydratée',           desc:'« Bien hydratée » noté 10 fois',    color:'#38bdf8' },
  // ── Jeux du trône 🎮 (v2.19.0) ────────────────────────────
  { id:'sniper',       icon:'🎯', label:'Sniper',                  desc:'10 Plop parfaits d\'affilée',        color:'#ef4444' },
  { id:'architecte',   icon:'🧻', label:'Architecte',              desc:'Tour de PQ de 50 rouleaux',         color:'#0ea5e9' },
  { id:'transit',      icon:'🐍', label:'Transit Express',         desc:'Un Côlon long de 30',               color:'#16a34a' },
  { id:'justeATemps',  icon:'🚽', label:'Juste à Temps',           desc:'1 000 m dans la Course au trône',   color:'#f97316' },
  { id:'detective',    icon:'🕵️', label:'Détective',               desc:'10 bonnes réponses d\'affilée au quiz', color:'#6366f1' },
  { id:'sortieDigne',  icon:'🚪', label:'Sortie Digne',            desc:'20 séances de jeu finies avant 8 min', color:'#10b981' },
  { id:'mainVerte',    icon:'🌻', label:'Main Verte',              desc:'5 plantations dans la fosse',       color:'#65a30d' },
  { id:'gameuse',      icon:'🎮', label:'Gameuse',                 desc:'50 parties jouées',                 color:'#a855f7' },
  // ── Le Grand Transit et le vrai test du maïs 🌽 (v2.20.0) ──
  { id:'grandTransit',   icon:'🌽', label:'Le Grand Transit',      desc:'Ressortir entier, bouche → sortie',  color:'#eab308' },
  { id:'ressortiIntact', icon:'🛡️', label:'Ressortie Intacte',     desc:'Arriver avec 90 % de carapace',      color:'#0ea5e9' },
  { id:'testMais',       icon:'⏳', label:'Test du Maïs',          desc:'Un vrai temps de transit mesuré',    color:'#f97316' },
];

// Rangement de l'onglet Badges (v2.18.0) : 75 badges d'un bloc, c'était une
// liste à faire défiler sans fin. Chaque badge appartient à une catégorie.
const BADGE_CATEGORIES = [
  { id:'classiques', label:'⭐ Les classiques',        ids:['first','rainbow','veteran','retro','frenchie','centenaire','nightcaca'] },
  { id:'series',     label:'🔥 Séries',                ids:['streak3','streak5','streak7','streak14','streak30'] },
  { id:'volume',     label:'📦 Volume',                ids:['poops25','poops50','poops200','poops365','poops500','poops1000'] },
  { id:'horaires',   label:'🕐 Horaires',              ids:['earlyBird','morningPerson','afterLunch','eveningCaca','nightOwl5','earlyMorning','midnight'] },
  { id:'rafales',    label:'🎯 Journées chargées',     ids:['double','triple','quad','volcano','speedRunner','ultraSpeed','sigma'] },
  { id:'semaine',    label:'📆 Jours de la semaine',   ids:['mondayBlues','weekendW','fridayFun','allWeekDays','lucky7'] },
  { id:'textures',   label:'🎨 Textures et couleurs',  ids:['allTextures','softie','hardRock','normalNormal','explosive','colorCollect','allColors','brownMaster','greenPower'] },
  { id:'notes',      label:'📝 Notes et humeurs',      ids:['journaliste','philosopher','novelist','moodStart','allMoods'] },
  { id:'speciaux',   label:'🌟 Spéciaux',              ids:['worldChamp','retroMaster','consistent','comeback','veteran50','veteran100','anniversary','bingo'] },
  { id:'lieux',      label:'🗺️ Lieux et conquête',     ids:['explorer','globetrotter','casaniere','firstDrop','cartographe','touriste','roadtrip','passeport','aventuriere','longCourrier','pleineNature'] },
  { id:'sante',      label:'⏱️ Durée et santé',        ids:['chrono','express','marathon','carnet','hydratee','testMais'] },
  { id:'jeux',       label:'🎮 Jeux du trône',          ids:['sniper','architecte','transit','justeATemps','detective','sortieDigne','mainVerte','gameuse','grandTransit','ressortiIntact'] },
];

// Badges que la rareté ne peut pas calculer honnêtement : ils dépendent de
// données qu'on ne lit pas chez les copines — le contenu des notes et les
// positions, qui restent privés. Mieux vaut ne rien afficher qu'un faux 0.
const RARITY_SKIP = new Set([
  'journaliste', 'philosopher', 'novelist',
  'firstDrop', 'cartographe', 'touriste', 'roadtrip', 'passeport',
  'aventuriere', 'longCourrier', 'pleineNature',
  // Carnet de santé : privé, jamais lu chez les copines
  'carnet', 'hydratee',
  // Jeux du trône : statistiques gardées sur le téléphone de chacune
  'sniper', 'architecte', 'transit', 'justeATemps', 'detective', 'sortieDigne', 'mainVerte', 'gameuse',
  'grandTransit', 'ressortiIntact',
  // Test du maïs : mesure personnelle, gardée sur le téléphone
  'testMais',
]);

function badgeCardHTML(b) {
  return `
    <div class="badge-card card p-4 rounded-[1.5rem] text-center border-2 transition-all" data-badge="${b.id}" style="border-color:transparent">
      <div class="text-4xl mb-2" aria-hidden="true">${b.icon}</div>
      <div class="font-bold text-sm">${b.label}</div>
      <div class="text-xs opacity-60 mb-2">${b.desc}</div>
      <div class="w-full rounded-full overflow-hidden" style="height:6px;background:rgba(0,0,0,0.1)">
        <div class="badge-bar" style="height:100%;border-radius:99px;width:0%;background:${b.color};transition:width .5s ease"></div>
      </div>
      <div class="badge-rarity text-xs mt-2"></div>
    </div>`;
}

const BADGE_OPEN_KEY = 'badges.openCats';

function buildBadgesGrid() {
  const grid = $id('badges-grid');
  if (!grid) return;
  let ouvertes = null;
  try { ouvertes = JSON.parse(localStorage.getItem(BADGE_OPEN_KEY) || 'null'); } catch {}
  grid.innerHTML = BADGE_CATEGORIES.map((c, i) => {
    const defs = c.ids.map(id => BADGE_DEFS.find(b => b.id === id)).filter(Boolean);
    // Par défaut, seule la première catégorie est dépliée.
    const ouverte = Array.isArray(ouvertes) ? ouvertes.includes(c.id) : i === 0;
    return `
      <details class="badge-cat" data-cat="${c.id}"${ouverte ? ' open' : ''}>
        <summary class="badge-cat-head">
          <span class="font-bold">${c.label}</span>
          <span class="badge-cat-count text-xs font-bold"></span>
        </summary>
        <div class="grid grid-cols-2 gap-3 pt-3">${defs.map(badgeCardHTML).join('')}</div>
      </details>`;
  }).join('');
  grid.querySelectorAll('.badge-cat').forEach(d => d.addEventListener('toggle', () => {
    const ids = [...grid.querySelectorAll('.badge-cat[open]')].map(x => x.dataset.cat);
    try { localStorage.setItem(BADGE_OPEN_KEY, JSON.stringify(ids)); } catch {}
  }));
}

/**
 * Fonction pure : les badges pas encore gagnés les plus avancés, pour
 * montrer « ce qui est à portée » plutôt qu'un mur de cases grises.
 */
function nextBadges(etats, n = 3) {
  return BADGE_DEFS
    .map((b, ordre) => ({ ...b, ordre, pct: etats[b.id]?.pct || 0, done: !!etats[b.id]?.done }))
    .filter(b => !b.done && b.pct > 0 && b.pct < 100)
    .sort((a, b) => b.pct - a.pct || a.ordre - b.ordre)
    .slice(0, n);
}

function updateBadges() {
  const badges = computeBadges(state.logs, calculateStreak(), typeof loadGameStats === 'function' ? loadGameStats() : null);

  Object.entries(badges).forEach(([id, {pct, done}]) => {
    const card = document.querySelector(`[data-badge="${id}"]`);
    if (!card) return;
    const bar = card.querySelector('.badge-bar');
    if (bar) bar.style.width = pct.toFixed(0) + '%';
    const def = BADGE_DEFS.find(b => b.id === id);
    card.style.borderColor = done ? (def?.color || '#f59e0b') : 'transparent';
    card.style.opacity = done ? '1' : '0.65';
  });

  // Compteurs par catégorie et au total
  let gagnes = 0;
  BADGE_CATEGORIES.forEach(c => {
    const n = c.ids.filter(id => badges[id]?.done).length;
    gagnes += n;
    const el = document.querySelector(`.badge-cat[data-cat="${c.id}"] .badge-cat-count`);
    if (el) el.textContent = `${n}/${c.ids.length}`;
  });
  const resume = $id('badges-summary');
  if (resume) {
    const total = BADGE_DEFS.length;
    resume.innerHTML = `
      <div class="flex items-center justify-between text-sm font-bold mb-1">
        <span>🏆 ${gagnes} badge${gagnes > 1 ? 's' : ''} sur ${total}</span>
        <span style="color:var(--accent)">${Math.round(gagnes / total * 100)} %</span>
      </div>
      <div class="w-full rounded-full overflow-hidden" style="height:8px;background:rgba(0,0,0,0.08)">
        <div style="width:${gagnes / total * 100}%;height:100%;border-radius:99px;background:var(--accent);transition:width .6s"></div>
      </div>`;
  }

  const prochains = $id('badges-next');
  if (prochains) {
    const liste = nextBadges(badges);
    prochains.classList.toggle('hidden', !liste.length);
    prochains.innerHTML = liste.length ? `
      <div class="font-bold text-sm mb-2">🎯 À portée de main</div>
      ${liste.map(b => `
        <div class="flex items-center gap-3 py-1.5">
          <span class="text-2xl" aria-hidden="true">${b.icon}</span>
          <div class="flex-1 min-w-0">
            <div class="flex justify-between text-xs font-bold"><span class="truncate">${b.label}</span><span>${Math.round(b.pct)} %</span></div>
            <div class="text-[11px] opacity-60 truncate">${b.desc}</div>
            <div class="w-full rounded-full overflow-hidden mt-1" style="height:5px;background:rgba(0,0,0,0.08)">
              <div style="width:${b.pct}%;height:100%;border-radius:99px;background:${b.color}"></div>
            </div>
          </div>
        </div>`).join('')}` : '';
  }
}

// Fonction pure : l'état de chaque badge pour une liste d'entrées donnée.
// Extraite d'updateBadges pour pouvoir la rejouer sur les entrées d'une
// copine et en déduire la rareté d'un badge.
// `games` : statistiques locales des Jeux du trône (null : badges de jeu à 0).
function computeBadges(logs, streak, games = null) {
  const total = logs.length;
  const now   = new Date();

  // ── Helpers ──────────────────────────────────────────────
  const countsByDay = {}; // 'YYYY-MM-DD' → count
  logs.forEach(l => {
    const key = new Date(l.date).toDateString();
    countsByDay[key] = (countsByDay[key] || 0) + 1;
  });

  const last7Logs = (() => {
    let c = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      c += logs.filter(l => new Date(l.date).toDateString() === d.toDateString()).length;
    }
    return c;
  })();
  const avg7 = last7Logs / 7;

  const maxPerDay = Math.max(...Object.values(countsByDay), 0);

  // Fast same-day counts
  const dayGroups = {};
  logs.forEach(l => {
    const k = new Date(l.date).toDateString();
    if (!dayGroups[k]) dayGroups[k] = [];
    dayGroups[k].push(l);
  });

  // Streak speed: X cacas in N hours
  function minHoursForN(n) {
    if (logs.length < n) return Infinity;
    const sorted = [...logs].sort((a,b) => a.date - b.date);
    let min = Infinity;
    for (let i = 0; i <= sorted.length - n; i++) {
      const diff = (sorted[i+n-1].date - sorted[i].date) / 3600000;
      min = Math.min(min, diff);
    }
    return min;
  }

  // First log date
  const firstDate = logs.length ? new Date(Math.min(...logs.map(l => l.date))) : null;
  const daysSinceFirst = firstDate ? Math.floor((now - firstDate) / 86400000) : 0;

  // Comments, moods
  const commentCount = logs.filter(l => l.comment?.trim()).length;
  const moodsUsed    = new Set(logs.map(l => l.mood).filter(Boolean));
  const allMoodsList = ['normal','douloureux','urgent','difficile'];

  // Lieux (PoopMap)
  const placesUsed = new Set(logs.map(l => l.place).filter(Boolean));
  const nbPlaces   = window.PoopMapModule?.PLACES.length || 8;
  const atHome     = logs.filter(l => l.place === 'maison').length;

  // Conquête (PoopMap) — tout est à 0 tant que la position n'est pas activée
  const pm         = window.PoopMapModule;
  const geoloc     = pm ? logs.filter(l => pm.hasGeo(l)) : [];
  const conquete   = pm ? pm.conquestStats(logs) : { cities: [], regions: [], countries: [] };
  const geoInfos   = pm ? pm.geoStats(logs) : null;
  const spots      = geoInfos?.spots || 0;
  const plusLoinKm = geoInfos?.farthestKm || 0;
  const natureGeo  = geoloc.filter(l => l.place === 'nature').length;

  // Durée et carnet de santé (v2.18.0)
  const durees      = logs.map(l => Number(l.duration)).filter(d => Number.isFinite(d) && d > 0 && d <= 10800);
  const nbExpress   = durees.filter(d => d < 120).length;
  const plusLongue  = durees.length ? Math.max(...durees) : 0;
  const avecSante   = logs.filter(l => Array.isArray(l.health) && l.health.length).length;
  const hydratees   = logs.filter(l => Array.isArray(l.health) && l.health.includes('hydratee')).length;

  // Colors & textures
  const colorsUsed   = new Set(logs.map(l => l.color).filter(Boolean));
  const texturesUsed = new Set(logs.map(l => l.texture).filter(Boolean));
  const allTexList   = ['normal','dur','mou','spray','liquide','explosif'];

  // Comeback: last gap > 7 days followed by new logs
  const hasComeback = (() => {
    const s = [...logs].sort((a,b) => a.date - b.date);
    for (let i = 1; i < s.length; i++) {
      if ((s[i].date - s[i-1].date) / 86400000 > 7) return true;
    }
    return false;
  })();

  // Consistent same hour ±2h over 5 days
  const isConsistent = (() => {
    if (logs.length < 5) return false;
    const sorted = [...logs].sort((a,b) => b.date - a.date);
    const hours = sorted.slice(0, 5).map(l => new Date(l.date).getHours());
    const avg = hours.reduce((a,b)=>a+b,0)/5;
    return hours.every(h => Math.abs(h - avg) <= 2);
  })();

  // Whole-week coverage (Mon-Sun same calendar week)
  const allWeekDaysDone = (() => {
    const weekMap = {};
    logs.forEach(l => {
      const d = new Date(l.date);
      const mon = new Date(d); mon.setDate(d.getDate() - (d.getDay()===0?6:d.getDay()-1)); mon.setHours(0,0,0,0);
      const wk = mon.getTime();
      if (!weekMap[wk]) weekMap[wk] = new Set();
      weekMap[wk].add(d.getDay()===0?7:d.getDay()); // 1=Mon…7=Sun
    });
    return Object.values(weekMap).some(s => s.size >= 7);
  })();

  // Lucky 7: 7 cacas on a 7th of the month
  const hasLucky7 = (() => {
    const on7th = logs.filter(l => new Date(l.date).getDate() === 7);
    const days7 = new Set(on7th.map(l => new Date(l.date).toDateString()));
    return days7.size >= 1 &&
      [...days7].some(d => logs.filter(l => new Date(l.date).toDateString() === d).length >= 7);
  })();

  // ── Badge conditions ─────────────────────────────────────
  const badges = {
    // Originals
    first:        { pct: total>=1?100:0,                               done: total>=1 },
    streak3:      { pct: Math.min(100,(streak/3)*100),                 done: streak>=3 },
    rainbow:      { pct: colorsUsed.has('arc-en-ciel')?100:0,          done: colorsUsed.has('arc-en-ciel') },
    veteran:      { pct: Math.min(100,(total/10)*100),                 done: total>=10 },
    retro:        { pct: logs.some(l=>l.isRetro)?100:0,                done: logs.some(l=>l.isRetro) },
    frenchie:     { pct: Math.min(100,(avg7/1.1)*100),                 done: avg7>=1.1 },
    centenaire:   { pct: Math.min(100,(total/100)*100),                done: total>=100 },
    nightcaca:    { pct: logs.some(l=>{const h=new Date(l.date).getHours();return h<5;})?100:0,
                    done: logs.some(l=>{const h=new Date(l.date).getHours();return h<5;}) },
    // Streaks
    streak5:      { pct: Math.min(100,(streak/5)*100),                 done: streak>=5 },
    streak7:      { pct: Math.min(100,(streak/7)*100),                 done: streak>=7 },
    streak14:     { pct: Math.min(100,(streak/14)*100),                done: streak>=14 },
    streak30:     { pct: Math.min(100,(streak/30)*100),                done: streak>=30 },
    // Volume
    poops25:      { pct: Math.min(100,(total/25)*100),                 done: total>=25 },
    poops50:      { pct: Math.min(100,(total/50)*100),                 done: total>=50 },
    poops200:     { pct: Math.min(100,(total/200)*100),                done: total>=200 },
    poops365:     { pct: Math.min(100,(total/365)*100),                done: total>=365 },
    poops500:     { pct: Math.min(100,(total/500)*100),                done: total>=500 },
    poops1000:    { pct: Math.min(100,(total/1000)*100),               done: total>=1000 },
    // Time of day
    earlyBird:    { pct: logs.some(l=>new Date(l.date).getHours()<7)?100:0,
                    done: logs.some(l=>new Date(l.date).getHours()<7) },
    morningPerson:{ pct: Math.min(100,(logs.filter(l=>new Date(l.date).getHours()<8).length/10)*100),
                    done: logs.filter(l=>new Date(l.date).getHours()<8).length>=10 },
    afterLunch:   { pct: Math.min(100,(logs.filter(l=>{const h=new Date(l.date).getHours();return h>=12&&h<14;}).length/5)*100),
                    done: logs.filter(l=>{const h=new Date(l.date).getHours();return h>=12&&h<14;}).length>=5 },
    eveningCaca:  { pct: Math.min(100,(logs.filter(l=>{const h=new Date(l.date).getHours();return h>=18&&h<21;}).length/5)*100),
                    done: logs.filter(l=>{const h=new Date(l.date).getHours();return h>=18&&h<21;}).length>=5 },
    nightOwl5:    { pct: Math.min(100,(logs.filter(l=>new Date(l.date).getHours()<5).length/5)*100),
                    done: logs.filter(l=>new Date(l.date).getHours()<5).length>=5 },
    earlyMorning: { pct: logs.some(l=>new Date(l.date).getHours()<6)?100:0,
                    done: logs.some(l=>new Date(l.date).getHours()<6) },
    // Multi per day
    double:       { pct: maxPerDay>=2?100:0,                          done: maxPerDay>=2 },
    triple:       { pct: maxPerDay>=3?100:0,                          done: maxPerDay>=3 },
    quad:         { pct: maxPerDay>=4?100:0,                          done: maxPerDay>=4 },
    volcano:      { pct: maxPerDay>=5?100:0,                          done: maxPerDay>=5 },
    // Week days
    mondayBlues:  { pct: logs.some(l=>new Date(l.date).getDay()===1)?100:0,
                    done: logs.some(l=>new Date(l.date).getDay()===1) },
    weekendW:     { pct: Math.min(100,(logs.filter(l=>{const d=new Date(l.date).getDay();return d===0||d===6;}).length/5)*100),
                    done: logs.filter(l=>{const d=new Date(l.date).getDay();return d===0||d===6;}).length>=5 },
    fridayFun:    { pct: logs.some(l=>new Date(l.date).getDay()===5&&new Date(l.date).getHours()>=18)?100:0,
                    done: logs.some(l=>new Date(l.date).getDay()===5&&new Date(l.date).getHours()>=18) },
    // Textures
    allTextures:  { pct: Math.min(100,(texturesUsed.size/allTexList.length)*100),
                    done: allTexList.every(t=>texturesUsed.has(t)) },
    softie:       { pct: Math.min(100,(logs.filter(l=>l.texture==='mou').length/10)*100),
                    done: logs.filter(l=>l.texture==='mou').length>=10 },
    hardRock:     { pct: Math.min(100,(logs.filter(l=>l.texture==='dur').length/5)*100),
                    done: logs.filter(l=>l.texture==='dur').length>=5 },
    normalNormal: { pct: Math.min(100,(logs.filter(l=>l.texture==='normal').length/20)*100),
                    done: logs.filter(l=>l.texture==='normal').length>=20 },
    explosive:    { pct: Math.min(100,(logs.filter(l=>l.texture==='explosif').length/5)*100),
                    done: logs.filter(l=>l.texture==='explosif').length>=5 },
    // Colors
    colorCollect: { pct: Math.min(100,(colorsUsed.size/5)*100),       done: colorsUsed.size>=5 },
    allColors:    { pct: Math.min(100,(colorsUsed.size/6)*100),        done: colorsUsed.size>=6 },
    brownMaster:  { pct: Math.min(100,(logs.filter(l=>l.color==='marron').length/20)*100),
                    done: logs.filter(l=>l.color==='marron').length>=20 },
    greenPower:   { pct: Math.min(100,(logs.filter(l=>l.color==='vert').length/5)*100),
                    done: logs.filter(l=>l.color==='vert').length>=5 },
    // Speed
    speedRunner:  { pct: minHoursForN(3)<=12?100:0,                   done: minHoursForN(3)<=12 },
    ultraSpeed:   { pct: minHoursForN(4)<=8?100:0,                    done: minHoursForN(4)<=8 },
    sigma:        { pct: minHoursForN(2)<=1?100:0,                    done: minHoursForN(2)<=1 },
    // Comments & mood
    journaliste:  { pct: commentCount>=1?100:0,                       done: commentCount>=1 },
    philosopher:  { pct: Math.min(100,(commentCount/10)*100),         done: commentCount>=10 },
    novelist:     { pct: Math.min(100,(commentCount/30)*100),         done: commentCount>=30 },
    moodStart:    { pct: moodsUsed.size>=1?100:0,                     done: moodsUsed.size>=1 },
    allMoods:     { pct: Math.min(100,(moodsUsed.size/allMoodsList.length)*100),
                    done: allMoodsList.every(m=>moodsUsed.has(m)) },
    // Special
    worldChamp:   { pct: Math.min(100,(avg7/1.4)*100),                done: avg7>=1.4 },
    retroMaster:  { pct: Math.min(100,(logs.filter(l=>l.isRetro).length/5)*100),
                    done: logs.filter(l=>l.isRetro).length>=5 },
    consistent:   { pct: isConsistent?100:0,                          done: isConsistent },
    comeback:     { pct: hasComeback?100:0,                           done: hasComeback },
    veteran50:    { pct: Math.min(100,(daysSinceFirst/50)*100),       done: daysSinceFirst>=50 },
    veteran100:   { pct: Math.min(100,(daysSinceFirst/100)*100),      done: daysSinceFirst>=100 },
    anniversary:  { pct: Math.min(100,(daysSinceFirst/365)*100),      done: daysSinceFirst>=365 },
    bingo:        { pct: total>=42?100:0,                             done: total===42||total>42 },
    lucky7:       { pct: hasLucky7?100:0,                             done: hasLucky7 },
    midnight:     { pct: logs.some(l=>{const h=new Date(l.date).getHours();return h>=23||h<1;})?100:0,
                    done: logs.some(l=>{const h=new Date(l.date).getHours();return h>=23||h<1;}) },
    allWeekDays:  { pct: allWeekDaysDone?100:0,                       done: allWeekDaysDone },
    // PoopMap
    explorer:     { pct: Math.min(100,(placesUsed.size/3)*100),       done: placesUsed.size>=3 },
    globetrotter: { pct: Math.min(100,(placesUsed.size/nbPlaces)*100),done: placesUsed.size>=nbPlaces },
    casaniere:    { pct: Math.min(100,(atHome/20)*100),               done: atHome>=20 },
    // Conquête
    firstDrop:    { pct: geoloc.length>=1?100:0,                      done: geoloc.length>=1 },
    cartographe:  { pct: Math.min(100,(spots/10)*100),                done: spots>=10 },
    touriste:     { pct: Math.min(100,(conquete.cities.length/3)*100),   done: conquete.cities.length>=3 },
    roadtrip:     { pct: Math.min(100,(conquete.regions.length/3)*100),  done: conquete.regions.length>=3 },
    passeport:    { pct: Math.min(100,(conquete.countries.length/2)*100),done: conquete.countries.length>=2 },
    aventuriere:  { pct: Math.min(100,(plusLoinKm/50)*100),           done: plusLoinKm>=50 },
    longCourrier: { pct: Math.min(100,(plusLoinKm/500)*100),          done: plusLoinKm>=500 },
    pleineNature: { pct: natureGeo>=1?100:0,                          done: natureGeo>=1 },
    // Durée et santé
    chrono:       { pct: durees.length>=1?100:0,                      done: durees.length>=1 },
    express:      { pct: Math.min(100,(nbExpress/5)*100),             done: nbExpress>=5 },
    marathon:     { pct: Math.min(100,(plusLongue/900)*100),          done: plusLongue>=900 },
    carnet:       { pct: Math.min(100,(avecSante/10)*100),            done: avecSante>=10 },
    hydratee:     { pct: Math.min(100,(hydratees/10)*100),            done: hydratees>=10 },
  };

  // Jeux du trône : progression calculée par js/jeux/jeux-core.js. Si ce
  // fichier manque, les badges restent à 0 plutôt que de disparaître.
  const jeux = typeof gameBadgeStates === 'function' ? gameBadgeStates(games) : {};
  BADGE_CATEGORIES.find(c => c.id === 'jeux').ids.forEach(id => {
    badges[id] = jeux[id] || { pct: 0, done: false };
  });
  // Test du maïs (app-mais.js) : mesure locale, pas une statistique de jeu.
  badges.testMais = typeof maisBadgeState === 'function' ? maisBadgeState() : { pct: 0, done: false };

  return badges;
}

// ===================================================
//  RARETÉ DES BADGES (dans l'esprit de PoopMap)
// ===================================================
// « Seules 2 copines sur 5 l'ont » : on rejoue les conditions sur les entrées
// de chaque membre du groupe. Rien de nouveau à stocker côté base.
let _rarityCache = { at: 0, groupId: null, data: null };
const RARITY_TTL = 5 * 60 * 1000;

async function updateBadgeRarity() {
  if (!$id('badges-grid') || !window.SupabaseClient?.isLoggedIn() || !navigator.onLine) return;
  // L'onglet Social n'a peut-être jamais été ouvert : on prend alors le
  // premier groupe de l'utilisatrice.
  let groupId = window.SocialModule?.currentGroupId?.();
  if (!groupId) {
    const groupes = await window.SupabaseClient.getMyGroups().catch(() => []);
    groupId = groupes[0]?.id;
  }
  if (!groupId) return;

  try {
    const frais = _rarityCache.groupId === groupId && Date.now() - _rarityCache.at < RARITY_TTL;
    if (!frais) {
      const membres = await window.SupabaseClient.getGroupBadgeData(groupId);
      _rarityCache = { at: Date.now(), groupId, data: membres };
    }
    renderBadgeRarity(_rarityCache.data);
  } catch (e) {
    $debug('rarity err: ' + e.message);
  }
}

/**
 * Fonction pure : niveau de rareté d'un badge dans le groupe.
 * n = copines qui l'ont (soi comprise), total = taille du groupe.
 */
function rarityTier(n, total) {
  if (!total || total < 2) return null;
  if (n === 0) return { id: 'inedit', label: 'Inédit' };
  if (n === 1 && total >= 3) return { id: 'legendaire', label: 'Légendaire' };
  const pct = n / total;
  if (pct <= 0.34) return { id: 'epique', label: 'Épique' };
  if (pct <= 0.67) return { id: 'rare', label: 'Rare' };
  return { id: 'commun', label: 'Commun' };
}

function renderBadgeRarity(membres) {
  if (!membres?.length || membres.length < 2) return;   // seule, la rareté n'a pas de sens
  const compte = {};
  membres.forEach(m => {
    const etats = computeBadges(m.logs, calculateStreak(m.logs));
    Object.entries(etats).forEach(([id, { done }]) => {
      if (done) compte[id] = (compte[id] || 0) + 1;
    });
  });

  BADGE_DEFS.forEach(b => {
    const el = document.querySelector(`[data-badge="${b.id}"] .badge-rarity`);
    if (!el) return;
    if (RARITY_SKIP.has(b.id)) { el.textContent = ''; return; }
    const n = compte[b.id] || 0;
    const tier = rarityTier(n, membres.length);
    // Palier d'abord (ce qui se frime), le décompte ensuite, plus discret.
    el.innerHTML = tier
      ? `<span class="rarity-chip rarity-${tier.id}">${tier.label}</span> <span class="opacity-60">${n}/${membres.length}</span>`
      : '';
  });
}
