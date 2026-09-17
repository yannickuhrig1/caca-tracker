// ============================================================
//  quiz.js — Qui a fait ce caca ? 🕵️
//  Une entrée récente d'une copine du groupe (jour, heure, texture,
//  couleur, lieu, durée) : à toi de deviner qui. 3 erreurs et c'est fini.
//  N'utilise que des colonnes déjà lisibles par le groupe (RLS de poops) ;
//  ni note ni position ni carnet de santé.
//  Logique pure testée : test/jeux-quiz-fosse.test.js
// ============================================================

const QUIZ = {
  VIES: 3,
  TEMPS_S: 12,
  CHOIX_MAX: 4,
  JOURS: 30,
  MEMOIRE: 25,           // entrées récemment posées, à ne pas reposer tout de suite
};

const QUIZ_TEXTURES = { normal: ['💩', 'Normal'], dur: ['🗿', 'Dur'], mou: ['🍮', 'Mou'], spray: ['💦', 'Spray'], liquide: ['🌊', 'Liquide'], explosif: ['💥', 'Explosif'] };
const QUIZ_COULEURS = { marron: 'marron', jaune: 'jaune', vert: 'vert', noir: 'noir', 'arc-en-ciel': 'arc-en-ciel', rouge: 'rouge' };
const QUIZ_JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/**
 * Entrées jouables : celles des AUTRES membres, depuis `QUIZ.JOURS` jours.
 * Rend { pool, candidats } ; `candidats` = membres (hors moi) ayant au moins
 * une entrée. Le quiz n'a de sens qu'avec deux candidates ou plus.
 */
function quizPool(rows, members, myId, now = Date.now()) {
  const depuis = now - QUIZ.JOURS * 86400000;
  const ids = new Set((members || []).filter(m => m.id !== myId).map(m => m.id));
  const pool = (rows || []).filter(r => ids.has(r.user_id) && r.date >= depuis && r.date <= now);
  const avecEntrees = new Set(pool.map(r => r.user_id));
  const candidats = (members || []).filter(m => avecEntrees.has(m.id));
  return { pool, candidats, jouable: candidats.length >= 2 };
}

function quizShuffle(liste, rng = Math.random) {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Tire une question. Chaque candidate a la même chance d'être la réponse,
 * quel que soit son nombre d'entrées : sinon la plus active gagnerait à tous
 * les coups et il suffirait de toujours la choisir.
 * `recents` : clés des entrées déjà posées, évitées tant que possible.
 */
function quizQuestion(pool, candidats, rng = Math.random, recents = []) {
  if (!pool?.length || (candidats?.length || 0) < 2) return null;
  const vue = new Set(recents);
  const cle = e => `${e.user_id}:${e.date}`;
  const cible = candidats[Math.floor(rng() * candidats.length)];
  const siennes = pool.filter(e => e.user_id === cible.id);
  const fraiches = siennes.filter(e => !vue.has(cle(e)));
  const choixEntrees = fraiches.length ? fraiches : siennes;
  const entry = choixEntrees[Math.floor(rng() * choixEntrees.length)];
  const autres = quizShuffle(candidats.filter(c => c.id !== cible.id), rng).slice(0, QUIZ.CHOIX_MAX - 1);
  return { entry, key: cle(entry), answer: cible.id, options: quizShuffle([cible, ...autres], rng) };
}

/** Indices lisibles pour une entrée : [{ emoji, text }]. */
function quizClues(e) {
  const d = new Date(e.date);
  const lignes = [
    { emoji: '📅', text: `${QUIZ_JOURS[d.getDay()]} ${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}` },
    { emoji: '🕐', text: `${String(d.getHours()).padStart(2, '0')} h ${String(d.getMinutes()).padStart(2, '0')}` },
  ];
  const tx = QUIZ_TEXTURES[e.texture];
  if (tx) lignes.push({ emoji: tx[0], text: tx[1] });
  if (QUIZ_COULEURS[e.color]) lignes.push({ emoji: '🎨', text: QUIZ_COULEURS[e.color] });
  if (e.place) {
    const meta = typeof window !== 'undefined' && window.PoopMapModule?.placeMeta?.(e.place);
    if (meta) lignes.push({ emoji: meta.emoji, text: meta.label });
  }
  if (Number.isFinite(e.duration_s) && e.duration_s > 0) {
    lignes.push({ emoji: '⏱️', text: e.duration_s < 60 ? `${e.duration_s} s` : `${Math.round(e.duration_s / 60)} min` });
  }
  return lignes;
}

function quizNew() {
  return { score: 0, lives: QUIZ.VIES, streak: 0, bestStreak: 0, question: null, left: QUIZ.TEMPS_S, recents: [], over: false, answered: null };
}

/** Réponse (id de membre, ou null si le temps est écoulé). Rend true si c'était juste. */
function quizAnswer(s, memberId) {
  if (s.over || !s.question || s.answered) return false;
  const juste = memberId === s.question.answer;
  s.answered = { memberId, juste };
  if (juste) {
    s.score++;
    s.streak++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
  } else {
    s.lives--;
    s.streak = 0;
    if (s.lives <= 0) s.over = true;
  }
  s.recents = [s.question.key, ...s.recents].slice(0, QUIZ.MEMOIRE);
  return juste;
}

function quizNext(s, pool, candidats, rng = Math.random) {
  if (s.over) return null;
  s.question = quizQuestion(pool, candidats, rng, s.recents);
  s.left = QUIZ.TEMPS_S;
  s.answered = null;
  return s.question;
}

function quizCreate(env) {
  const s = quizNew();
  const stage = env.stage;
  let pool = [], candidats = [], pret = false, pause = 0;
  const escHTML = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function message(emoji, titre, texte) {
    stage.innerHTML = `<div class="quiz-msg"><div class="quiz-msg-emoji">${emoji}</div><h3>${escHTML(titre)}</h3><p>${escHTML(texte)}</p></div>`;
  }

  function render() {
    const q = s.question;
    if (!q) return;
    const r = s.answered;
    stage.innerHTML = `
      <div class="quiz">
        <div class="quiz-top">
          <span>${'💩'.repeat(s.lives)}<span class="quiz-lost">${'💩'.repeat(QUIZ.VIES - s.lives)}</span></span>
          <span>${s.streak >= 2 ? `🔥 x${s.streak}` : ''}</span>
        </div>
        <div class="quiz-timer"><div class="quiz-timer-fill" style="width:${Math.max(0, s.left / QUIZ.TEMPS_S * 100)}%"></div></div>
        <div class="quiz-card">
          <div class="quiz-q">Qui a fait ce caca ?</div>
          <ul class="quiz-clues">${quizClues(q.entry).map(c => `<li><span aria-hidden="true">${c.emoji}</span> ${escHTML(c.text)}</li>`).join('')}</ul>
        </div>
        <div class="quiz-options">
          ${q.options.map(o => {
            const etat = !r ? '' : o.id === q.answer ? ' good' : o.id === r.memberId ? ' bad' : ' dim';
            return `<button type="button" class="quiz-opt${etat}" data-member="${escHTML(o.id)}"${r ? ' disabled' : ''}>
              <span class="quiz-opt-avatar">${escHTML(o.avatar || '💩')}</span><span class="quiz-opt-name">${escHTML(o.username)}</span></button>`;
          }).join('')}
        </div>
        ${r ? `<div class="quiz-verdict">${r.juste ? '✅ Bien vu !' : r.memberId ? '❌ Raté !' : '⌛ Trop tard !'}</div>` : ''}
      </div>`;
    stage.querySelectorAll('.quiz-opt').forEach(b => b.addEventListener('click', () => choisir(b.dataset.member)));
  }

  function choisir(id) {
    if (!pret || s.answered) return;
    const juste = quizAnswer(s, id);
    env.haptic(juste ? [10, 20, 10] : [40, 30, 40]);
    env.onScore(s.score);
    pause = 1.1;
    render();
  }

  async function charger() {
    message('🔎', 'On fouille le feed…', 'Un instant.');
    try {
      const data = await env.loadQuizData?.();
      if (!data) {
        message('👥', 'Il faut un groupe', 'Connecte-toi et rejoins un groupe de copines pour jouer au détective.');
        return;
      }
      ({ pool, candidats } = quizPool(data.rows, data.members, data.myId));
      if (candidats.length < 2) {
        message('🤷', 'Pas assez de suspectes', 'Il faut au moins deux copines ayant posté ce mois-ci.');
        return;
      }
      pret = true;
      env.onStart?.();
      quizNext(s, pool, candidats, env.rng);
      render();
    } catch (e) {
      message('📡', 'Réseau indisponible', 'Le quiz a besoin du feed de ton groupe. Réessaie une fois connectée.');
    }
  }
  charger();

  return {
    dom: true,
    hint: 'Touche le nom de la coupable',
    update(dt) {
      if (!pret) return;
      if (pause > 0) {
        pause -= dt;
        if (pause <= 0) {
          if (s.over) { pret = false; env.onOver({ score: s.score, streak: s.bestStreak }); return; }
          quizNext(s, pool, candidats, env.rng);
          render();
        }
        return;
      }
      const avant = Math.ceil(s.left);
      s.left -= dt;
      if (s.left <= 0) { choisir(null); return; }
      const fill = stage.querySelector('.quiz-timer-fill');
      if (fill) fill.style.width = `${Math.max(0, s.left / QUIZ.TEMPS_S * 100)}%`;
      if (Math.ceil(s.left) !== avant && s.left <= 3) env.haptic(4);
    },
  };
}

window.JeuQuiz = { QUIZ, quizPool, quizShuffle, quizQuestion, quizClues, quizNew, quizAnswer, quizNext, create: quizCreate };
