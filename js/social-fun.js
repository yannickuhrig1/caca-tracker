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
];

const STICKER_RE = /^:sticker:([a-z0-9-]+):$/;

function stickerBody(id) {
  return STICKERS.some(s => s.id === id) ? `:sticker:${id}:` : null;
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

window.SocialFun = { STICKERS, stickerBody, parseSticker, groupStreak, enduranceRanking, leagueWeekStart };
