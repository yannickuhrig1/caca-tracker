// ============================================================
// 🎉 Social : fonctions pures des nouveautés v2.18.0
//   stickers de commentaires, série partagée du groupe,
//   reine de l'endurance, semaine de la ligue.
// Chargé avant social.js, qui s'en sert. Testé : test/social-fun.test.js
// ============================================================

// ---- Stickers ----
// Un sticker voyage comme un commentaire ordinaire : « :sticker:bravo: ».
// Aucun changement en base, et un vieux client affiche au pire ce texte court.
const STICKERS = [
  { id: 'bravo',     art: '💩👏', text: 'Bravo !' },
  { id: 'legende',   art: '👑💩', text: 'Légende' },
  { id: 'feu',       art: '🔥💩🔥', text: 'En feu' },
  { id: 'rip',       art: '🚽🪦', text: 'RIP les toilettes' },
  { id: 'odeur',     art: '🤢💨', text: 'Ça sent d\'ici' },
  { id: 'fier',      art: '🥹💩', text: 'Tellement fière' },
  { id: 'marathon',  art: '📖⏱️', text: 'Tu lisais un roman ?' },
  { id: 'express',   art: '⚡🏃‍♀️', text: 'Express !' },
  { id: 'jaloux',    art: '😤💩', text: 'Jalouse' },
  { id: 'eau',       art: '💧🥤', text: 'Bois de l\'eau' },
  { id: 'coeur',     art: '💖💩', text: 'Love' },
  { id: 'mdr',       art: '🤣🤣', text: 'MDR' },
  // Jeux du trône (v2.19.0) : à débloquer avec le badge indiqué. Tout le monde
  // les VOIT dans les commentaires ; seule leur pose est réservée.
  { id: 'plop-parfait', art: '🎯🚽', text: 'Plop parfait',          unlock: 'sniper' },
  { id: 'tour-pq',      art: '🧻🧻🧻', text: 'Tour de PQ',          unlock: 'architecte' },
  { id: 'detective',    art: '🕵️💩', text: 'Je sais que c\'est toi', unlock: 'detective' },
  { id: 'sortie-digne', art: '🚪✨', text: 'Sortie digne',          unlock: 'sortieDigne' },
  { id: 'jardin',       art: '🌻💩', text: 'Engrais de qualité',    unlock: 'mainVerte' },
];

const STICKER_RE = /^:sticker:([a-z0-9-]+):$/;

function stickerBody(id) {
  return STICKERS.some(s => s.id === id) ? `:sticker:${id}:` : null;
}

/** Le sticker peut-il être posé ? `badgesDone` : ids des badges gagnés. */
function stickerUnlocked(st, badgesDone) {
  if (!st) return false;
  if (!st.unlock) return true;
  return [...(badgesDone || [])].includes(st.unlock);
}

/** Le sticker d'un commentaire, ou null si c'est du texte (ou un id inconnu). */
function parseSticker(body) {
  const m = STICKER_RE.exec(String(body || '').trim());
  return m ? STICKERS.find(s => s.id === m[1]) || null : null;
}

// ---- Série partagée du groupe ----
/**
 * Jours d'affilée où TOUTES les membres actives ont posté. Une membre est
 * active si elle a posté dans les 30 derniers jours : une copine partie ne
 * doit pas bloquer le groupe pour toujours.
 * `stats` : valeurs de getGroupStats (username, avatar, days = toDateString[]).
 * Rend null s'il n'y a pas au moins deux membres actives.
 */
function groupStreak(stats, now = Date.now()) {
  const jourIl = i => { const d = new Date(now); d.setDate(d.getDate() - i); return d.toDateString(); };
  const trenteJours = new Set(Array.from({ length: 30 }, (_, i) => jourIl(i)));
  const actives = (stats || [])
    .map(m => ({ ...m, jours: new Set(m.days || []) }))
    .filter(m => [...m.jours].some(j => trenteJours.has(j)));
  if (actives.length < 2) return null;

  const tousLe = i => actives.every(m => m.jours.has(jourIl(i)));
  const aujourdhui = tousLe(0);
  let jours = 0;
  for (let i = aujourdhui ? 0 : 1; i < 366 && tousLe(i); i++) jours++;

  return {
    days: jours,
    includesToday: aujourdhui,
    activeMembers: actives.length,
    missingToday: actives.filter(m => !m.jours.has(jourIl(0))).map(m => ({ id: m.id, username: m.username, avatar: m.avatar })),
  };
}

// ---- Reine de l'endurance ----
/** Classement par plus longue séance du mois ; seules les membres chronométrées. */
function enduranceRanking(members) {
  return (members || [])
    .map(m => {
      const d = (m.durations || []).filter(x => Number.isFinite(x) && x > 0);
      if (!d.length) return null;
      const total = d.reduce((a, b) => a + b, 0);
      return { id: m.id, username: m.username, avatar: m.avatar, count: d.length, max: Math.max(...d), avg: Math.round(total / d.length), total };
    })
    .filter(Boolean)
    .sort((a, b) => b.max - a.max || b.total - a.total);
}

// ---- Ligue ----
/** Lundi 00:00 (heure locale) de la semaine de `now`, en epoch ms. */
function leagueWeekStart(now = Date.now()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
  return d.getTime();
}

// ---- Fiche membre (stats détaillées vues par les copines, v2.22.0) ----
// Fonction pure : les données viennent d'en haut (getGroupBadgeData +
// getGroupStats + getGroupTrophies), le rendu DOM reste dans social.js.
const TEXTURE_META = {
  normal:   ['💩', 'Normal'], dur: ['🗿', 'Dur'], mou: ['🍮', 'Mou'],
  spray:    ['💦', 'Spray'], liquide: ['🌊', 'Liquide'], explosif: ['💥', 'Explosif'],
};
const COLOR_META = {
  marron: ['🟤', 'Marron'], jaune: ['🟡', 'Jaune'], vert: ['🟢', 'Vert'],
  noir:   ['⚫', 'Noir'], 'arc-en-ciel': ['🌈', 'Arc-en-ciel'], rouge: ['🔴', 'Rouge'],
};

function buildMemberCard(member, logs, stats = {}, trophies = 0, now = Date.now()) {
  const entries = (logs || []).slice().sort((a, b) => a.date - b.date);
  // Les logs détaillés ne sont servis qu'à partir de 2 membres (getGroupBadgeData).
  // Seule dans son groupe, une membre verrait sinon « 0 caca » malgré un total réel.
  const total = entries.length || (stats.total || 0);

  const texCount = {}, colCount = {}, moods = {};
  entries.forEach(l => {
    const t = l.texture || 'normal'; texCount[t] = (texCount[t] || 0) + 1;
    const c = l.color   || 'marron'; colCount[c] = (colCount[c] || 0) + 1;
    if (l.mood) moods[l.mood] = (moods[l.mood] || 0) + 1;
  });
  const pct = n => total ? Math.round(n / total * 100) : 0;
  const breakdown = (counts, meta) => Object.entries(counts)
    .map(([id, n]) => ({ id, emoji: (meta[id] || [id])[0], label: (meta[id] || [id, id])[1], count: n, pct: pct(n) }))
    .sort((a, b) => b.count - a.count);

  // Journée / semaine / mois les plus actifs
  const byDay = {}, byWeek = {}, byMonth = {};
  entries.forEach(l => {
    const d = new Date(l.date);
    const day = d.toDateString(); byDay[day] = (byDay[day] || 0) + 1;
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
    byWeek[monday.getTime()] = (byWeek[monday.getTime()] || 0) + 1;
    const m = `${d.getFullYear()}-${d.getMonth()}`; byMonth[m] = (byMonth[m] || 0) + 1;
  });
  const maxOf = obj => Object.values(obj).reduce((b, v) => Math.max(b, v), 0);

  // Série courante (jours d'affilée jusqu'à aujourd'hui)
  const days = new Set(entries.map(l => new Date(l.date).toDateString()));
  let streak = 0;
  const today = new Date(now);
  if (days.has(today.toDateString())) {
    streak = 1;
    for (let i = 1; i < 90; i++) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      if (days.has(d.toDateString())) streak++; else break;
    }
  }

  // Jours actifs et moyenne/jour sur 30 jours glissants
  const since30 = now - 30 * 86400000;
  const last30 = entries.filter(l => l.date >= since30);
  const active30 = new Set(last30.map(l => new Date(l.date).toDateString())).size;

  return {
    id:       member?.id,
    username: member?.username,
    avatar:   member?.avatar || '💩',
    trophies: trophies || 0,
    total,
    month:    stats.month || 0,
    week7:    stats.week7 || 0,
    streak,
    bestDay:    maxOf(byDay),
    bestWeek:   maxOf(byWeek),
    bestMonth:  maxOf(byMonth),
    active30,
    avg30:      +(last30.length / 30).toFixed(1),
    textures:   breakdown(texCount, TEXTURE_META),
    colors:     breakdown(colCount, COLOR_META),
    topMood:    Object.entries(moods).sort((a, b) => b[1] - a[1])[0] || null,
    firstPoop:  entries[0]?.date || null,
    lastPoop:   entries[entries.length - 1]?.date || null,
  };
}

/** Résumé textuel du partage de stats mensuel (rejouable : ref stable par mois). */
function statsShareText(card, now = Date.now()) {
  const d = new Date(now);
  const ref = `month_${d.getFullYear()}_${d.getMonth() + 1}`;
  const bits = [`${card.month} caca${card.month > 1 ? 's' : ''} ce mois`];
  if (card.streak > 0) bits.push(`🔥 ${card.streak} j de série`);
  if (card.topMood) bits.push(`humeur ${card.topMood[0]}`);
  return { ref, emoji: '📊', title: bits.join(' · ') };
}

window.SocialFun = {
  STICKERS, stickerBody, stickerUnlocked, parseSticker, groupStreak,
  enduranceRanking, leagueWeekStart,
  buildMemberCard, statsShareText,
};
