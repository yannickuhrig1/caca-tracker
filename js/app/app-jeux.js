// ============================================================
//  app-jeux.js
//  Jeux du trône (v2.19.0) : menu, partie (boucle, toucher, clavier),
//  temps limité branché sur le chrono, fin de partie avec la mascotte,
//  scores et badges, partage en story.
//  Charge apres js/jeux/*.js et app-wrapped.js (drawStory, shareCanvas).
// ============================================================

const JEUX_STATS_KEY = 'jeux.stats.v1';
const JEUX_PAUSE_KEY = 'jeux.pauseJusqua';

const JEUX_MOTEURS = () => ({
  plop: window.JeuPlop, pq: window.JeuPQ, colon: window.JeuColon,
  course: window.JeuCourse, quiz: window.JeuQuiz, fosse: window.JeuFosse,
});

// Libellés du record « exploit » de chaque jeu (fin de partie, story).
const JEUX_EXPLOITS = {
  plop:   { cle: 'perfectStreak',  label: 'parfaits d\'affilée', emoji: '🎯' },
  pq:     { cle: 'pqHeight',       label: 'étages au max',        emoji: '🧻' },
  colon:  { cle: 'colonLength',    label: 'de long au max',       emoji: '🐍' },
  course: { cle: 'courseDistance', label: 'mètres au max',        emoji: '🏃‍♀️' },
  quiz:   { cle: 'quizStreak',     label: 'bonnes d\'affilée',    emoji: '🕵️' },
};

// ===================================================
//  STATS LOCALES
// ===================================================
function loadGameStats() {
  try { return JeuxCore.normalizeGameStats(JSON.parse(localStorage.getItem(JEUX_STATS_KEY) || 'null')); }
  catch { return JeuxCore.defaultGameStats(); }
}

function saveGameStats(stats) {
  try { localStorage.setItem(JEUX_STATS_KEY, JSON.stringify(stats)); } catch {}
}

function jeuxPauseJusqua() {
  try { return Number(localStorage.getItem(JEUX_PAUSE_KEY)) || 0; } catch { return 0; }
}

// ===================================================
//  ÉTAT
// ===================================================
const _jeux = {
  open: false,
  start: null,          // début de la séance de jeu quand le chrono ne tourne pas
  played: 0,            // parties lancées pendant la séance
  gameId: null,
  inst: null,
  running: false,
  ended: false,
  score: 0,
  raf: 0,
  last: 0,
  tick: 0,
  size: { W: 0, H: 0, dpr: 1 },
  pointer: null,
  lastResult: null,
};

function jeuxChronoStart() {
  return typeof _timerStart !== 'undefined' && _timerStart ? _timerStart : null;
}

/**
 * Temps limité : on compte depuis le départ du chrono s'il tourne (la séance a
 * commencé avant la première partie), sinon depuis la première partie.
 */
function jeuxSessionNow() {
  const now = Date.now(), pause = jeuxPauseJusqua();
  const chrono = jeuxChronoStart();
  if (chrono !== null) {
    const s = JeuxCore.jeuxSession(now, chrono, pause);
    if (s.start !== null) return s;
    // Chrono oublié depuis longtemps : il ne compte plus, on retombe sur la séance de jeu.
  }
  const s = JeuxCore.jeuxSession(now, _jeux.start, pause);
  if (_jeux.start !== null && s.start === null) _jeux.start = null;
  return s;
}

const jeuxReduceMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ===================================================
//  MENU
// ===================================================
function renderJeuxHub() {
  const list = $id('jeux-list');
  if (!list) return;
  const stats = loadGameStats();
  const connectee = !!window.SupabaseClient?.isLoggedIn();
  list.innerHTML = JeuxCore.JEUX.map(j => {
    const best = stats.best[j.id];
    let sous = j.desc;
    if (j.id === 'fosse' && window.JeuFosse) {
      const f = JeuFosse.fosseState(state.logs, stats);
      sous = `${f.solde} d'engrais · ${f.owned.length}/${JeuFosse.FOSSE_ITEMS.length} plantations${f.recolteDispo ? ' · 🧺 récolte prête' : ''}`;
    }
    const verrou = j.groupe && !connectee;
    return `
      <button type="button" class="jeux-card${verrou ? ' dim' : ''}" data-jeu="${j.id}">
        <span class="jeux-card-emoji" aria-hidden="true">${j.emoji}</span>
        <span class="jeux-card-nom">${esc(j.nom)}</span>
        <span class="jeux-card-desc">${esc(verrou ? 'Connecte-toi et rejoins un groupe.' : sous)}</span>
        ${best ? `<span class="jeux-card-best">🏆 ${best} ${esc(j.unite)}</span>` : ''}
      </button>`;
  }).join('');
  renderJeuxSession();
}

function renderJeuxSession() {
  const el = $id('jeux-session');
  if (!el) return;
  const s = jeuxSessionNow();
  const fmt = JeuxCore.formatMinSec;
  let html;
  if (s.locked) {
    html = `<div class="jeux-session-box lock">😴 Les jeux font une pause encore <b>${fmt(s.lockRemaining)}</b>. Le jardin 🌻 reste ouvert.</div>`;
  } else if (s.start !== null) {
    html = `<div class="jeux-session-box">${jeuxChronoStart() ? '⏱️ Séance en cours' : '🎮 Séance de jeu'} · il reste <b>${fmt(s.remaining)}</b></div>`;
  } else if (jeuxChronoStart()) {
    html = '<div class="jeux-session-box">⏱️ Chrono lancé · 8 min de jeu maximum</div>';
  } else {
    html = '<button type="button" class="jeux-session-box jeux-chrono-btn" data-act="chrono">⏱️ Je m\'installe : lancer le chrono</button>';
  }
  // Rafraîchi toutes les 500 ms : ne rien reconstruire si rien n'a changé,
  // sinon un bouton remplacé entre l'appui et le relâcher perd le clic.
  if (el.dataset.html === html) return;
  el.dataset.html = html;
  el.innerHTML = html;
  el.querySelector('[data-act="chrono"]')?.addEventListener('click', () => {
    if (typeof startTimer === 'function' && !jeuxChronoStart()) startTimer();
    renderJeuxSession();
  });
}

window.openJeux = function(gameId) {
  const modal = $id('jeux-modal');
  if (!modal || !window.JeuxCore) return;
  _jeux.open = true;
  modal.classList.remove('hidden');
  document.body.classList.add('jeux-open');
  showJeuxScreen('hub');
  renderJeuxHub();
  syncGameScores();
  clearInterval(_jeux.tick);
  _jeux.tick = setInterval(jeuxTick, 500);
  if (gameId && JeuxCore.jeuMeta(gameId)) launchJeu(gameId);
  else $id('jeux-close')?.focus();
};

function closeJeux() {
  stopJeu();
  _jeux.open = false;
  clearInterval(_jeux.tick);
  $id('jeux-modal')?.classList.add('hidden');
  document.body.classList.remove('jeux-open');
}

function showJeuxScreen(nom) {
  $id('jeux-hub')?.classList.toggle('hidden', nom !== 'hub');
  $id('jeux-play')?.classList.toggle('hidden', nom !== 'play');
}

// ===================================================
//  PARTIE
// ===================================================
function launchJeu(gameId) {
  const meta = JeuxCore.jeuMeta(gameId);
  const moteur = JEUX_MOTEURS()[gameId];
  if (!meta || !moteur) return;
  if (meta.trone && jeuxSessionNow().locked) {
    window.UI?.toast('Pause des jeux en cours : lève-toi, bouge un peu 🚶‍♀️', 'info');
    renderJeuxSession();
    return;
  }
  stopJeu(true);
  _jeux.gameId = gameId;
  _jeux.score = 0;
  _jeux.ended = false;
  _jeux.counted = false;
  showJeuxScreen('play');
  $id('jeux-play-name').textContent = `${meta.emoji} ${meta.nom}`;
  $id('jeux-play-score').textContent = meta.classement ? '0' : '';
  $id('jeux-timebar')?.classList.toggle('hidden', !meta.trone);
  // Le jardin n'est pas une séance : pas de bouton « Fini ».
  $id('jeux-done')?.classList.toggle('hidden', !meta.trone);
  $id('jeux-over')?.classList.add('hidden');

  const canvas = $id('jeux-canvas');
  const dom = $id('jeux-dom');
  sizeJeuxCanvas();
  const env = {
    canvas,
    ctx: canvas.getContext('2d'),
    stage: dom,
    get W() { return _jeux.size.W; },
    get H() { return _jeux.size.H; },
    rng: Math.random,
    reduceMotion: jeuxReduceMotion(),
    haptic: p => { if (typeof haptic === 'function') haptic(p); },
    toast: (m, t = 'success') => window.UI?.toast(m, t),
    onScore: n => {
      _jeux.score = n;
      const el = $id('jeux-play-score');
      if (el && meta.classement) el.textContent = n;
    },
    onOver: result => endJeu(result),
    // Le quiz démarre le temps de jeu une fois ses questions chargées.
    onStart: () => countJeuxPartie(),
    getStats: loadGameStats,
    setStats: s => { saveGameStats(s); checkGameBadges(); },
    getLogs: () => state.logs,
    loadQuizData: async () => {
      if (!window.SupabaseClient?.isLoggedIn()) return null;
      let groupId = window.SocialModule?.currentGroupId?.();
      if (!groupId) groupId = (await window.SupabaseClient.getMyGroups())[0]?.id;
      return groupId ? window.SupabaseClient.getQuizData(groupId) : null;
    },
  };
  _jeux.inst = moteur.create(env);
  const inst = _jeux.inst;
  canvas.classList.toggle('hidden', !!inst.dom);
  dom.classList.toggle('hidden', !inst.dom);
  if (!inst.dom) dom.innerHTML = '';

  if (inst.dom) {
    // Quiz et jardin : pas d'écran « touche pour commencer ». Le jardin n'a
    // pas de boucle : il ne réagit qu'aux boutons.
    if (!inst.idle) runJeu();
  } else {
    drawJeuFrame(0);
    showJeuxReady(inst.hint, 'Touche pour commencer');
  }
}

/** Une partie commence vraiment : elle ouvre la séance de jeu si besoin. */
function countJeuxPartie() {
  if (_jeux.counted) return;
  _jeux.counted = true;
  const meta = JeuxCore.jeuMeta(_jeux.gameId);
  if (!meta?.trone) return;
  if (jeuxSessionNow().start === null) {
    _jeux.start = Date.now();
    _jeux.played = 0;
    _jeux.warned = false;
    _jeux.capped = false;
  }
  _jeux.played++;
}

function showJeuxReady(hint, action) {
  const el = $id('jeux-ready');
  if (!el) return;
  el.innerHTML = `<div class="jeux-ready-box"><div class="jeux-ready-hint">${esc(hint || '')}</div><div class="jeux-ready-go">${esc(action)}</div></div>`;
  el.classList.remove('hidden');
}

function hideJeuxReady() { $id('jeux-ready')?.classList.add('hidden'); }

function runJeu() {
  if (!_jeux.inst || _jeux.running) return;
  _jeux.running = true;
  _jeux.last = performance.now();
  cancelAnimationFrame(_jeux.raf);
  _jeux.raf = requestAnimationFrame(jeuxFrame);
}

function pauseJeu() {
  if (!_jeux.running || _jeux.ended || _jeux.inst?.dom) return;
  _jeux.running = false;
  cancelAnimationFrame(_jeux.raf);
  showJeuxReady('⏸️ Pause', 'Touche pour reprendre');
}

function jeuxFrame(ts) {
  if (!_jeux.running || !_jeux.inst) return;
  // dt plafonné : un onglet revenu de veille ne doit pas téléporter le jeu.
  const dt = Math.min(0.05, Math.max(0, (ts - _jeux.last) / 1000));
  _jeux.last = ts;
  if (!_jeux.ended) _jeux.inst.update(dt);
  drawJeuFrame(dt);
  if (_jeux.running) _jeux.raf = requestAnimationFrame(jeuxFrame);
}

function drawJeuFrame(dt) {
  const inst = _jeux.inst;
  if (!inst || inst.dom) return;
  const ctx = $id('jeux-canvas').getContext('2d');
  const { dpr } = _jeux.size;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  inst.draw(dt);
}

function stopJeu(silencieux = false) {
  _jeux.running = false;
  cancelAnimationFrame(_jeux.raf);
  // Partie interrompue en cours de route (retour, fermeture, chrono arrêté) :
  // le score atteint compte quand même, sauf s'il est nul.
  if (!silencieux && _jeux.inst && !_jeux.ended && _jeux.score > 0 && !_jeux.inst.idle) {
    enregistrerPartie({ score: _jeux.score });
  }
  _jeux.inst = null;
  hideJeuxReady();
}

function enregistrerPartie(result) {
  const avantBadges = new Set(JeuxCore.gameBadgesDone(loadGameStats()));
  const r = JeuxCore.recordGame(loadGameStats(), _jeux.gameId, result);
  saveGameStats(r.stats);
  checkGameBadges(avantBadges);
  if (r.weekRecord) syncGameScores();
  return r;
}

function endJeu(result) {
  if (_jeux.ended) return;
  _jeux.ended = true;
  _jeux.score = result.score;
  const gameId = _jeux.gameId;
  const r = enregistrerPartie(result);
  _jeux.lastResult = { gameId, result, ...r };
  // On laisse la chute ou l'éclaboussure se finir avant le bilan.
  setTimeout(() => {
    if (_jeux.gameId !== gameId || !_jeux.ended) return;
    _jeux.running = false;
    cancelAnimationFrame(_jeux.raf);
    showJeuxOver(false);
  }, _jeux.inst?.dom ? 250 : 800);
}

// ===================================================
//  FIN DE PARTIE ET TEMPS LIMITÉ
// ===================================================
function showJeuxOver(limite) {
  const el = $id('jeux-over');
  const lr = _jeux.lastResult;
  if (!el) return;
  const meta = JeuxCore.jeuMeta(_jeux.gameId);
  const stats = loadGameStats();
  let mood, message;
  if (limite) {
    mood = 'sleepy';
    message = 'Allez, on libère le trône ! 8 minutes, c\'est le max pour tes fesses.';
  } else {
    ({ mood, message } = JeuxCore.gameOverMascot(lr.result.score, lr.previousBest, { plays: stats.plays[_jeux.gameId], splash: !!lr.result.splash }));
    if (lr.result.reason === 'accident') message = 'Trop tard… la jauge a débordé. Pense aux toilettes 🚽 !';
  }
  const exploit = JEUX_EXPLOITS[_jeux.gameId];
  const session = jeuxSessionNow();
  const peutRejouer = !limite && !session.locked;
  el.innerHTML = `
    <div class="jeux-over-box">
      <div class="jeux-over-mascot">${typeof mascotSVG === 'function' ? mascotSVG(mood, 'none') : '💩'}</div>
      <p class="jeux-over-msg">${esc(message)}</p>
      ${lr ? `
        <div class="jeux-over-score">${lr.result.score}<span>${esc(meta.unite)}</span></div>
        ${lr.record && lr.previousBest > 0 ? '<div class="jeux-over-tag">🏆 Nouveau record</div>' : ''}
        <div class="jeux-over-stats">
          <span>🏆 Record : <b>${stats.best[_jeux.gameId] || 0}</b></span>
          ${exploit ? `<span>${exploit.emoji} <b>${stats.records[exploit.cle]}</b> ${esc(exploit.label)}</span>` : ''}
        </div>` : ''}
      <div class="jeux-over-actions">
        ${limite
          ? `${jeuxChronoStart() ? '<button type="button" class="jeux-btn primary" data-act="fini">✅ J\'ai fini</button>' : ''}
             <button type="button" class="jeux-btn" data-act="fermer">Fermer</button>`
          : `${peutRejouer ? '<button type="button" class="jeux-btn primary" data-act="rejouer">🔁 Rejouer</button>' : ''}
             ${lr && lr.result.score > 0 ? '<button type="button" class="jeux-btn" data-act="partager">📤 Partager</button>' : ''}
             <button type="button" class="jeux-btn" data-act="menu">🎮 Autres jeux</button>`}
      </div>
    </div>`;
  el.classList.remove('hidden');
  el.querySelector('[data-act="rejouer"]')?.addEventListener('click', () => launchJeu(_jeux.gameId));
  el.querySelector('[data-act="menu"]')?.addEventListener('click', backToHub);
  el.querySelector('[data-act="partager"]')?.addEventListener('click', shareJeuStory);
  el.querySelector('[data-act="fini"]')?.addEventListener('click', finishJeuxSession);
  el.querySelector('[data-act="fermer"]')?.addEventListener('click', closeJeux);
  el.querySelector('.jeux-btn')?.focus();
}

function backToHub() {
  stopJeu();
  $id('jeux-over')?.classList.add('hidden');
  showJeuxScreen('hub');
  renderJeuxHub();
}

/** Toutes les 500 ms tant que les jeux sont ouverts. */
function jeuxTick() {
  if (!_jeux.open) return;
  const s = jeuxSessionNow();
  const meta = JeuxCore.jeuMeta(_jeux.gameId);
  const enPartie = !$id('jeux-play')?.classList.contains('hidden');
  if (!enPartie) { renderJeuxSession(); return; }
  if (!meta?.trone) return;

  const fill = $id('jeux-timebar-fill'), txt = $id('jeux-timebar-txt'), bar = $id('jeux-timebar');
  const actif = s.start !== null;
  if (fill) fill.style.width = `${actif ? (s.remaining / JeuxCore.JEUX_LIMITE_S) * 100 : 100}%`;
  if (txt) txt.textContent = actif ? `${JeuxCore.formatMinSec(s.remaining)} de jeu restant` : '8:00 de jeu';
  bar?.classList.toggle('warn', s.warn);
  if (s.warn && !_jeux.warned) {
    _jeux.warned = true;
    window.UI?.toast('Plus qu\'une minute de jeu, pense à conclure 🧻', 'info');
    if (typeof haptic === 'function') haptic([20, 60, 20]);
  }
  if (s.over && !_jeux.capped) reachJeuxLimit();
}

function reachJeuxLimit() {
  _jeux.capped = true;
  if (_jeux.inst && !_jeux.ended && _jeux.score > 0 && !_jeux.inst.idle) enregistrerPartie({ score: _jeux.score });
  _jeux.ended = true;
  _jeux.running = false;
  cancelAnimationFrame(_jeux.raf);
  hideJeuxReady();
  try { localStorage.setItem(JEUX_PAUSE_KEY, String(Date.now() + JeuxCore.JEUX_PAUSE_MS)); } catch {}
  _jeux.start = null;
  _jeux.played = 0;
  _jeux.lastResult = null;
  if (typeof haptic === 'function') haptic([60, 40, 60]);
  showJeuxOver(true);
}

/**
 * Fin de séance : « ✅ Fini » dans les jeux ou chrono arrêté. Avant la
 * limite et après au moins une partie, c'est une sortie digne.
 */
function concludeJeuxSession() {
  const s = jeuxSessionNow();
  // Au moins une minute : ouvrir un jeu et repartir aussitôt ne compte pas.
  const digne = _jeux.played > 0 && s.start !== null && !s.over && s.elapsed >= 60;
  if (_jeux.inst && !_jeux.ended) stopJeu();
  if (digne) {
    const avant = new Set(JeuxCore.gameBadgesDone(loadGameStats()));
    const stats = loadGameStats();
    stats.sortiesDignes++;
    saveGameStats(stats);
    checkGameBadges(avant);
    window.UI?.toast(`🚪 Sortie digne ! +${window.JeuFosse?.FOSSE_GAIN.PAR_SORTIE_DIGNE || 20} d'engrais pour ton jardin`, 'party', 4000);
  }
  _jeux.start = null;
  _jeux.played = 0;
  _jeux.warned = false;
  _jeux.capped = false;
}

function finishJeuxSession() {
  if (jeuxChronoStart() && typeof stopTimer === 'function') {
    // stopTimer appelle jeuxOnTimerStop, qui conclut et ferme.
    stopTimer(false);
    return;
  }
  concludeJeuxSession();
  closeJeux();
}

/** Appelé par stopTimer() (app-pwa.js) AVANT la remise à zéro du chrono. */
function jeuxOnTimerStop(cancel) {
  if (cancel) {
    // Chrono annulé : le temps de jeu continue de compter depuis son départ.
    if (_jeux.played > 0 && _jeux.start === null) _jeux.start = jeuxChronoStart();
    return;
  }
  concludeJeuxSession();
  if (_jeux.open) closeJeux();
}

// ===================================================
//  BADGES ET SCORES
// ===================================================
function checkGameBadges(avant = null) {
  const apres = JeuxCore.gameBadgesDone(loadGameStats());
  if (avant) {
    apres.filter(id => !avant.has(id)).forEach(id => {
      const def = typeof BADGE_DEFS !== 'undefined' ? BADGE_DEFS.find(b => b.id === id) : null;
      if (!def) return;
      window.UI?.toast(`${def.icon} Badge débloqué : ${def.label}`, 'party', 4500);
      if (window.SupabaseClient?.isLoggedIn()) {
        window.SupabaseClient.publishBadgeEvent({ id: def.id, name: def.label, icon: def.icon }).catch(() => {});
      }
    });
  }
  if (typeof updateBadges === 'function') updateBadges();
}

let _jeuxSyncing = false;
async function syncGameScores() {
  if (_jeuxSyncing || !window.SupabaseClient?.isLoggedIn() || !navigator.onLine) return;
  const aEnvoyer = JeuxCore.unsyncedWeekScores(loadGameStats());
  if (!aEnvoyer.length) return;
  _jeuxSyncing = true;
  try {
    let envoye = false;
    for (const ligne of aEnvoyer) {
      const ok = await window.SupabaseClient.saveGameScore(ligne);
      if (!ok) continue;
      // Relire : une partie a pu se terminer pendant l'envoi.
      const stats = loadGameStats();
      if (stats.week.start === ligne.week_start && stats.week.scores[ligne.game] === ligne.score) {
        stats.week.synced[ligne.game] = true;
        saveGameStats(stats);
      }
      envoye = true;
    }
    if (envoye) window.SocialModule?.refreshGameBoard?.();
  } catch (e) {
    $debug('jeux sync err: ' + e.message);
  } finally {
    _jeuxSyncing = false;
  }
}

// ===================================================
//  PARTAGE EN STORY
// ===================================================
async function shareJeuStory() {
  const lr = _jeux.lastResult;
  if (!lr || typeof drawStory !== 'function') return;
  const meta = JeuxCore.jeuMeta(lr.gameId);
  const stats = loadGameStats();
  const exploit = JEUX_EXPLOITS[lr.gameId];
  const { mood } = JeuxCore.gameOverMascot(lr.result.score, lr.previousBest, { plays: stats.plays[lr.gameId] });
  try {
    const canvas = await drawStory({
      titre: `${meta.emoji} ${meta.nom}`,
      sousTitre: 'Jeux du trône',
      grand: lr.result.score,
      grandLabel: meta.unite,
      phrase: lr.record && lr.previousBest > 0 ? 'Nouveau record personnel !' : 'Qui fait mieux ?',
      tuiles: [
        { emoji: '🏆', label: 'record', value: stats.best[lr.gameId] || 0 },
        { emoji: '📅', label: 'record de la semaine', value: stats.week.scores[lr.gameId] || 0 },
        exploit ? { emoji: exploit.emoji, label: exploit.label, value: stats.records[exploit.cle] } : null,
        { emoji: '🎮', label: 'parties jouées', value: stats.plays[lr.gameId] || 0 },
      ].filter(Boolean),
      mood: mood === 'waiting' ? 'happy' : mood,
    });
    await shareCanvas(canvas, `jeux-${lr.gameId}.png`, `${meta.nom} : ${lr.result.score} ${meta.unite}`);
  } catch (e) {
    window.UI?.toast('Partage impossible : ' + e.message, 'error');
  }
}

// ===================================================
//  CANVAS ET ENTRÉES
// ===================================================
function sizeJeuxCanvas() {
  const stage = $id('jeux-stage'), canvas = $id('jeux-canvas');
  if (!stage || !canvas) return;
  const r = stage.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  _jeux.size = { W: Math.max(1, Math.floor(r.width)), H: Math.max(1, Math.floor(r.height)), dpr };
  canvas.width = _jeux.size.W * dpr;
  canvas.height = _jeux.size.H * dpr;
  canvas.style.width = `${_jeux.size.W}px`;
  canvas.style.height = `${_jeux.size.H}px`;
}

function jeuxInputReady() {
  // Écran « touche pour commencer / reprendre » : ce toucher-là ne joue pas.
  if (!$id('jeux-ready')?.classList.contains('hidden')) {
    hideJeuxReady();
    if (!_jeux.running && _jeux.inst) runJeu();
    return false;
  }
  return !!_jeux.inst && _jeux.running && !_jeux.ended && !_jeux.inst.dom;
}

function setupJeux() {
  const modal = $id('jeux-modal');
  if (!modal) return;

  $id('jeux-open-btn')?.addEventListener('click', () => window.openJeux());
  $id('timer-jeux-btn')?.addEventListener('click', () => window.openJeux());
  $id('jeux-close')?.addEventListener('click', closeJeux);
  $id('jeux-back')?.addEventListener('click', backToHub);
  $id('jeux-done')?.addEventListener('click', finishJeuxSession);
  $id('jeux-list')?.addEventListener('click', e => {
    const card = e.target.closest('[data-jeu]');
    if (!card) return;
    const meta = JeuxCore.jeuMeta(card.dataset.jeu);
    if (meta?.groupe && !window.SupabaseClient?.isLoggedIn()) {
      window.UI?.toast('Le quiz se joue avec les copines de ton groupe : connecte-toi d\'abord.', 'info');
      return;
    }
    launchJeu(card.dataset.jeu);
  });

  // La première pression d'une partie démarre le temps de jeu.
  const stage = $id('jeux-stage');
  const demarrer = () => {
    if (!_jeux.inst || _jeux.inst.dom || _jeux.running) return;
    countJeuxPartie();
  };

  stage?.addEventListener('pointerdown', e => {
    if (e.target.closest('#jeux-over') || e.target.closest('#jeux-dom')) return;
    e.preventDefault();
    demarrer();
    if (!jeuxInputReady()) return;
    const r = stage.getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId, fired: false };
    _jeux.pointer = p;
    // Jeux sans glissement : le toucher agit tout de suite, sans attendre le relâcher.
    if (!_jeux.inst.swipe) { p.fired = true; _jeux.inst.tap?.(p.x, p.y); }
  });
  stage?.addEventListener('pointermove', e => {
    const p = _jeux.pointer;
    if (!p || p.fired || e.pointerId !== p.id || !_jeux.inst?.swipe) return;
    const r = stage.getBoundingClientRect();
    const dx = e.clientX - r.left - p.x, dy = e.clientY - r.top - p.y;
    if (Math.hypot(dx, dy) < 22) return;
    p.fired = true;
    _jeux.inst.swipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  stage?.addEventListener('pointerup', e => {
    const p = _jeux.pointer;
    _jeux.pointer = null;
    if (!p || p.fired || e.pointerId !== p.id || !_jeux.running) return;
    _jeux.inst?.tap?.(p.x, p.y);
  });

  document.addEventListener('keydown', e => {
    if (!_jeux.open) return;
    if (e.key === 'Escape') {
      if (!$id('jeux-play').classList.contains('hidden')) backToHub(); else closeJeux();
      return;
    }
    if ($id('jeux-play').classList.contains('hidden') || !_jeux.inst || _jeux.inst.dom) return;
    if (e.target.closest?.('button')) return;
    const dirs = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    if (e.key === ' ' || e.key === 'Enter' || dirs[e.key]) {
      e.preventDefault();
      demarrer();
      if (!jeuxInputReady()) return;
      if (dirs[e.key] && _jeux.inst.swipe) _jeux.inst.swipe(dirs[e.key]);
      else _jeux.inst.tap?.(_jeux.size.W / 2, _jeux.size.H / 2);
    }
  });

  window.addEventListener('resize', () => { if (_jeux.open && _jeux.inst && !_jeux.inst.dom) { sizeJeuxCanvas(); drawJeuFrame(0); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseJeu(); });
  window.addEventListener('online', syncGameScores);
}

window.Jeux = {
  open: gameId => window.openJeux(gameId),
  badgesDone: () => JeuxCore.gameBadgesDone(loadGameStats()),
  stats: loadGameStats,
};
