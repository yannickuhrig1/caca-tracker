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
];

function buildBadgesGrid() {
  const grid = $id('badges-grid');
  if (!grid) return;
  grid.innerHTML = BADGE_DEFS.map(b => `
    <div class="card p-4 rounded-[1.5rem] text-center border-2 border-transparent transition-all" data-badge="${b.id}" style="border-color:transparent">
      <div class="text-4xl mb-2">${b.icon}</div>
      <div class="font-bold text-sm">${b.label}</div>
      <div class="text-xs opacity-60 mb-2">${b.desc}</div>
      <div class="w-full rounded-full overflow-hidden" style="height:6px;background:rgba(0,0,0,0.1)">
        <div class="badge-bar" style="height:100%;border-radius:99px;width:0%;background:${b.color};transition:width .5s ease"></div>
      </div>
    </div>`).join('');
}

function updateBadges() {
  const logs  = state.logs;
  const total = logs.length;
  const streak = calculateStreak();
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
  };

  Object.entries(badges).forEach(([id, {pct, done}]) => {
    const card = document.querySelector(`[data-badge="${id}"]`);
    if (!card) return;
    const bar = card.querySelector('.badge-bar');
    if (bar) bar.style.width = pct.toFixed(0) + '%';
    const def = BADGE_DEFS.find(b => b.id === id);
    card.style.borderColor = done ? (def?.color || '#f59e0b') : 'transparent';
    card.style.opacity = done ? '1' : '0.65';
  });
}
