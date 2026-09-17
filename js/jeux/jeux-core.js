// ============================================================
//  jeux-core.js
//  Jeux du trône (v2.19.0) : catalogue, temps limité, scores et
//  statistiques locales, badges, réaction de la mascotte, classement.
//  Fonctions pures uniquement : l'interface vit dans app-jeux.js.
//  Testé : test/jeux-core.test.js
// ============================================================

// ---- Temps limité ----
// Rester assis longtemps favorise les hémorroïdes ; on conseille de ne pas
// dépasser 5 à 10 minutes. Le jeu ne doit pas faire traîner la séance : au bout
// de 8 minutes la partie s'arrête, puis les jeux se reposent 10 minutes.
const JEUX_LIMITE_S = 8 * 60;
const JEUX_ALERTE_S = 60;
const JEUX_PAUSE_MS = 10 * 60 * 1000;

// `trone` : jeu fait pour la séance, soumis au temps limité.
// `classement` : score envoyé au classement hebdo du groupe.
const JEUX = [
  { id: 'plop',   emoji: '🚽', nom: 'Plop!',                 desc: 'Lâche au bon moment, vise le centre.', unite: 'pts',   trone: true,  classement: true },
  { id: 'pq',     emoji: '🧻', nom: 'Tour de PQ',            desc: 'Empile les rouleaux sans déborder.',    unite: 'étages', trone: true,  classement: true },
  { id: 'colon',  emoji: '🐍', nom: 'Le Côlon',              desc: 'Mange des fibres, évite le fast-food.', unite: 'pts',   trone: true,  classement: true },
  { id: 'course', emoji: '🏃‍♀️', nom: 'Course au trône',     desc: 'Saute les obstacles avant l\'accident.', unite: 'm',     trone: true,  classement: true },
  { id: 'quiz',   emoji: '🕵️', nom: 'Qui a fait ce caca ?',  desc: 'Devine quelle copine l\'a posé.',       unite: 'bonnes', trone: true,  classement: true, groupe: true },
  { id: 'transit', emoji: '🌽', nom: 'Le Grand Transit',     desc: 'Grain de maïs : de la bouche à la sortie.', unite: 'pts', trone: true, classement: true },
  { id: 'fosse',  emoji: '🌻', nom: 'Fosse septique tycoon', desc: 'Tes cacas deviennent un jardin.',       unite: '',      trone: false, classement: false },
];

const JEUX_CLASSES = JEUX.filter(j => j.classement).map(j => j.id);

function jeuMeta(id) {
  return JEUX.find(j => j.id === id) || null;
}

/**
 * État du temps limité à l'instant `now`.
 * `start` : début de la séance de jeu (ou du chrono), null si aucune.
 * `cooldownUntil` : fin de la pause imposée, 0 si aucune.
 * Une séance oubliée (plus vieille que limite + pause) ne compte plus.
 */
function jeuxSession(now, start, cooldownUntil = 0) {
  const locked = cooldownUntil > now;
  const vieille = start !== null && now - start > JEUX_LIMITE_S * 1000 + JEUX_PAUSE_MS;
  const debut = start === null || vieille ? null : start;
  const elapsed = debut === null ? 0 : Math.max(0, Math.floor((now - debut) / 1000));
  const remaining = Math.max(0, JEUX_LIMITE_S - elapsed);
  return {
    start: debut,
    elapsed,
    remaining,
    locked,
    lockRemaining: locked ? Math.ceil((cooldownUntil - now) / 1000) : 0,
    warn: debut !== null && remaining > 0 && remaining <= JEUX_ALERTE_S,
    over: debut !== null && remaining === 0,
  };
}

function formatMinSec(s) {
  const n = Math.max(0, Math.floor(s));
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}

/** Lundi 00:00 (heure locale) de la semaine de `now`, en epoch ms. */
function jeuxWeekStart(now = Date.now()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
  return d.getTime();
}

// ---- Statistiques locales ----
function defaultGameStats() {
  return {
    v: 1,
    best: {},              // meilleur score de tous les temps par jeu
    plays: {},             // nombre de parties par jeu
    records: {             // exploits qui débloquent badges et stickers
      perfectStreak: 0,    // Plop! : plops parfaits d'affilée
      pqHeight: 0,         // Tour de PQ : étages
      colonLength: 0,      // Le Côlon : longueur atteinte
      courseDistance: 0,   // Course au trône : mètres
      quizStreak: 0,       // Quiz : bonnes réponses d'affilée
      transitFinished: 0,  // Grand Transit : traversées complètes
      transitCarapace: 0,  // Grand Transit : meilleure carapace à l'arrivée
    },
    sortiesDignes: 0,      // séances de jeu terminées avant la limite
    week: { start: 0, scores: {}, synced: {} },
    fosse: { owned: [], lastHarvest: 0, harvested: 0 },
    // Grand Transit : sauvegarde au début de l'organe en cours
    transit: { checkpoint: null },
  };
}

/** Sauvegarde du Grand Transit relue prudemment, ou null. */
function normalizeTransitCheckpoint(cp) {
  if (!cp || typeof cp !== 'object') return null;
  const level = Number(cp.level);
  // 5 organes dans js/jeux/transit.js (bouche → côlon)
  if (!Number.isInteger(level) || level < 0 || level > 4) return null;
  const nb = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    level,
    carapace: Math.max(0, Math.min(100, nb(cp.carapace))),
    score: Math.max(0, nb(cp.score)),
    stars: Array.isArray(cp.stars) ? cp.stars.slice(0, 5).map(x => Math.max(0, Math.min(3, nb(x)))) : [],
  };
}

/** Relit des stats stockées en complétant les champs absents (vieille version, JSON abîmé). */
function normalizeGameStats(raw) {
  const base = defaultGameStats();
  if (!raw || typeof raw !== 'object') return base;
  const nombre = v => (Number.isFinite(v) && v >= 0 ? v : 0);
  const dict = o => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {})
    .filter(([k]) => jeuMeta(k)).map(([k, v]) => [k, nombre(v)]));
  const records = { ...base.records };
  Object.keys(records).forEach(k => { records[k] = nombre(raw.records?.[k]); });
  const fosse = raw.fosse && typeof raw.fosse === 'object' ? raw.fosse : {};
  return {
    v: 1,
    best: dict(raw.best),
    plays: dict(raw.plays),
    records,
    sortiesDignes: nombre(raw.sortiesDignes),
    week: {
      start: nombre(raw.week?.start),
      scores: dict(raw.week?.scores),
      synced: Object.fromEntries(Object.entries(raw.week?.synced || {}).filter(([k]) => jeuMeta(k)).map(([k, v]) => [k, !!v])),
    },
    fosse: {
      owned: Array.isArray(fosse.owned) ? fosse.owned.filter(x => typeof x === 'string') : [],
      lastHarvest: nombre(fosse.lastHarvest),
      harvested: nombre(fosse.harvested),
    },
    transit: { checkpoint: normalizeTransitCheckpoint(raw.transit?.checkpoint) },
  };
}

/**
 * Enregistre une partie terminée. Rend un NOUVEL objet de stats (l'ancien
 * n'est pas modifié) et ce qui mérite d'être fêté.
 * `result` : { score, perfectStreak?, height?, length?, distance?, streak? }
 */
function recordGame(stats, gameId, result, now = Date.now()) {
  const s = normalizeGameStats(JSON.parse(JSON.stringify(stats || {})));
  if (!jeuMeta(gameId)) return { stats: s, record: false, weekRecord: false, previousBest: 0 };
  const score = Math.max(0, Math.floor(Number(result?.score) || 0));
  const previousBest = s.best[gameId] || 0;
  s.plays[gameId] = (s.plays[gameId] || 0) + 1;
  const record = score > previousBest;
  if (record) s.best[gameId] = score;

  const r = s.records;
  const maxi = (cle, v) => { if (Number.isFinite(v) && v > r[cle]) r[cle] = Math.floor(v); };
  maxi('perfectStreak', result?.perfectStreak);
  maxi('pqHeight', result?.height);
  maxi('colonLength', result?.length);
  maxi('courseDistance', result?.distance);
  maxi('quizStreak', result?.streak);
  if (gameId === 'transit' && result?.finished) {
    r.transitFinished += 1;
    maxi('transitCarapace', result.carapace);
  }

  // Meilleur score de la semaine : c'est lui qui part au classement du groupe.
  const semaine = jeuxWeekStart(now);
  if (s.week.start !== semaine) s.week = { start: semaine, scores: {}, synced: {} };
  let weekRecord = false;
  if (jeuMeta(gameId).classement && score > (s.week.scores[gameId] || 0)) {
    s.week.scores[gameId] = score;
    s.week.synced[gameId] = false;
    weekRecord = true;
  }
  return { stats: s, record, weekRecord, previousBest };
}

/** Scores de la semaine en cours pas encore envoyés au cloud. */
function unsyncedWeekScores(stats, now = Date.now()) {
  const s = normalizeGameStats(stats);
  if (s.week.start !== jeuxWeekStart(now)) return [];
  return Object.entries(s.week.scores)
    .filter(([game, score]) => score > 0 && !s.week.synced[game] && jeuMeta(game)?.classement)
    .map(([game, score]) => ({ game, score, week_start: s.week.start }));
}

function totalPlays(stats) {
  return Object.values(normalizeGameStats(stats).plays).reduce((a, b) => a + b, 0);
}

// ---- Badges ----
// Les définitions (icône, libellé) vivent dans BADGE_DEFS (app-badges.js),
// catégorie « jeux ». Ici, seulement la progression.

/** État { pct, done } de chaque badge de jeu. `stats` absent : tout à zéro. */
function gameBadgeStates(stats) {
  const s = normalizeGameStats(stats);
  const palier = (v, cible) => ({ pct: Math.min(100, (v / cible) * 100), done: v >= cible });
  return {
    sniper:      palier(s.records.perfectStreak, 10),
    architecte:  palier(s.records.pqHeight, 50),
    transit:     palier(s.records.colonLength, 30),
    justeATemps: palier(s.records.courseDistance, 1000),
    detective:   palier(s.records.quizStreak, 10),
    sortieDigne: palier(s.sortiesDignes, 20),
    mainVerte:   palier(s.fosse.owned.length, 5),
    gameuse:     palier(totalPlays(s), 50),
    grandTransit:   palier(s.records.transitFinished, 1),
    ressortiIntact: palier(s.records.transitCarapace, 90),
  };
}

/** Ids des badges de jeu gagnés (sert aux stickers débloquables). */
function gameBadgesDone(stats) {
  return Object.entries(gameBadgeStates(stats)).filter(([, e]) => e.done).map(([id]) => id);
}

// ---- Mascotte ----
/** Humeur et phrase de la mascotte à la fin d'une partie. */
function gameOverMascot(score, previousBest, { plays = 1, splash = false } = {}) {
  if (score > previousBest && previousBest > 0) return { mood: 'party', message: `Nouveau record ! ${previousBest} → ${score}, je suis fière de toi.` };
  if (score > 0 && plays <= 1) return { mood: 'happy', message: 'Première partie, premier score. Ça commence bien !' };
  if (score === 0) return { mood: 'worried', message: splash ? 'Ouh là, ça a éclaboussé partout…' : 'Zéro pointé. On respire et on recommence ?' };
  if (previousBest > 0 && score >= previousBest * 0.8) return { mood: 'happy', message: 'Pas loin du record, encore un effort !' };
  return { mood: 'waiting', message: 'Pas mal. Ton record tient toujours, lui.' };
}

// ---- Classement ----
/**
 * Classement d'un jeu pour la semaine. `rows` : lignes game_scores
 * { user_id, game, score }, `members` : { id, username, avatar }.
 * Les membres sans score n'apparaissent pas.
 */
function gameLeaderboard(rows, members, game) {
  const parId = Object.fromEntries((members || []).map(m => [m.id, m]));
  const meilleur = {};
  (rows || []).forEach(r => {
    if (r.game !== game || !parId[r.user_id]) return;
    const sc = Number(r.score) || 0;
    if (sc > (meilleur[r.user_id] ?? -1)) meilleur[r.user_id] = sc;
  });
  return Object.entries(meilleur)
    .filter(([, sc]) => sc > 0)
    .map(([id, score]) => ({ id, username: parId[id].username, avatar: parId[id].avatar || '💩', score }))
    .sort((a, b) => b.score - a.score || String(a.username).localeCompare(String(b.username)));
}

// ---- Hasard reproductible (tests, parties rejouables) ----
function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Petits outils de dessin partagés par les jeux sur canvas ----
// Appelés seulement pendant une partie : rien ne touche au DOM au chargement.
const JeuxDessin = {
  police: '"Fredoka", "Segoe UI", system-ui, sans-serif',
  emoji(ctx, char, x, y, size) {
    ctx.save();
    // Un emoji en couleur prend l'opacité du fillStyle courant : sans ces deux
    // lignes, il héritait du dernier remplissage translucide (les tirets du sol
    // de la Course, à 25 %) et apparaissait délavé, comme sous un voile.
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 1;
    ctx.font = `${Math.round(size)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, x, y);
    ctx.restore();
  },
  texte(ctx, txt, x, y, { size = 20, weight = 700, color = '#fff', align = 'center', alpha = 1 } = {}) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${weight} ${Math.round(size)}px ${JeuxDessin.police}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, x, y);
    ctx.restore();
  },
  rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  },
  // Textes flottants (« PARFAIT ! », « +3 ») : [{ txt, x, y, t, color }]
  flotter(ctx, liste, dt) {
    for (let i = liste.length - 1; i >= 0; i--) {
      const f = liste[i];
      f.t += dt;
      if (f.t > 0.9) { liste.splice(i, 1); continue; }
      JeuxDessin.texte(ctx, f.txt, f.x, f.y - f.t * 50, { size: f.size || 22, color: f.color || '#fff', alpha: 1 - f.t / 0.9 });
    }
  },
};

window.JeuxCore = {
  JeuxDessin,
  JEUX, JEUX_CLASSES, JEUX_LIMITE_S, JEUX_ALERTE_S, JEUX_PAUSE_MS,
  jeuMeta, jeuxSession, formatMinSec, jeuxWeekStart,
  defaultGameStats, normalizeGameStats, normalizeTransitCheckpoint, recordGame, unsyncedWeekScores, totalPlays,
  gameBadgeStates, gameBadgesDone, gameOverMascot, gameLeaderboard, mulberry32,
};
