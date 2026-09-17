// ============================================================
//  app-wrapped.js
//  partage en image format story (1080x1920) et Caca Wrapped annuel
//  en ecrans successifs (v2.18.0). Remplace shareStats() et
//  openWrapped() d'app-goal.js.
//  Charge apres app-accueil.js (mascotSVG) et app-sante.js.
// ============================================================

const TEXTURE_LABELS_FR = { normal: 'Normal', dur: 'Dur', mou: 'Mou', spray: 'Spray', liquide: 'Liquide', explosif: 'Explosif' };
const TEXTURE_EMOJI_FR  = { normal: '💩', dur: '🗿', mou: '🍮', spray: '💦', liquide: '🌊', explosif: '💥' };
const MOIS_COURTS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS_LONGS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

// ===================================================
//  FONCTIONS PURES
// ===================================================
/** Début, fin (exclue) et libellé d'une période de partage. */
function periodRange(period, now = Date.now()) {
  const d = new Date(now);
  if (period === 'week') {
    const lundi = new Date(d); lundi.setHours(0, 0, 0, 0);
    lundi.setDate(lundi.getDate() - (lundi.getDay() === 0 ? 6 : lundi.getDay() - 1));
    return { start: lundi.getTime(), end: now + 1, label: 'Ma semaine' };
  }
  if (period === 'month') {
    const debut = new Date(d.getFullYear(), d.getMonth(), 1);
    return { start: debut.getTime(), end: now + 1, label: `Mon mois de ${MOIS_COURTS[d.getMonth()]}` };
  }
  const annee = typeof period === 'number' ? period : d.getFullYear();
  return {
    start: new Date(annee, 0, 1).getTime(),
    end: Math.min(new Date(annee + 1, 0, 1).getTime(), now + 1),
    label: `Mon année ${annee}`,
  };
}

/** Clé la plus fréquente d'un compteur { clé: n }, ou null. */
function topEntry(compteur) {
  const e = Object.entries(compteur).sort((a, b) => b[1] - a[1])[0];
  return e ? { key: e[0], count: e[1] } : null;
}

/** Plus longue suite de jours consécutifs avec au moins une entrée. */
function longestRun(logs) {
  const jours = [...new Set(logs.map(l => { const d = new Date(l.date); d.setHours(0, 0, 0, 0); return d.getTime(); }))].sort((a, b) => a - b);
  let best = 0, cur = 0, prev = null;
  jours.forEach(j => {
    // 20 à 28 h d'écart : les changements d'heure ne cassent pas la suite
    cur = prev !== null && j - prev > 20 * 3600000 && j - prev < 28 * 3600000 ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = j;
  });
  return best;
}

/** Fonction pure : ce qu'on affiche sur une image de partage. */
function shareCardData(logs, period, now = Date.now()) {
  const r = periodRange(period, now);
  const sub = (logs || []).filter(l => l.date >= r.start && l.date < r.end);
  const tex = {}, heures = {};
  sub.forEach(l => {
    if (l.texture) tex[l.texture] = (tex[l.texture] || 0) + 1;
    const h = new Date(l.date).getHours();
    heures[h] = (heures[h] || 0) + 1;
  });
  const topTex = topEntry(tex), topH = topEntry(heures);
  const jours = new Set(sub.map(l => new Date(l.date).toDateString())).size;
  const duree = typeof durationStats === 'function' ? durationStats(sub) : null;
  return {
    label: r.label,
    total: sub.length,
    kg: +(sub.length * 0.15).toFixed(1),
    activeDays: jours,
    bestRun: longestRun(sub),
    topTexture: topTex ? topTex.key : null,
    peakHour: topH ? Number(topH.key) : null,
    avgDuration: duree ? duree.avg : null,
  };
}

// Pour rendre le tonnage parlant. Poids approximatifs, c'est pour rire.
const WEIGHT_REFS = [
  { kg: 0.25, label: 'une baguette',        plural: 'baguettes' },
  { kg: 1,    label: 'un ananas',           plural: 'ananas' },
  { kg: 4,    label: 'un chat',             plural: 'chats' },
  { kg: 6,    label: 'une pastèque',        plural: 'pastèques' },
  { kg: 12,   label: 'un micro-ondes',      plural: 'micro-ondes' },
  { kg: 23,   label: 'une valise pleine',   plural: 'valises pleines' },
  { kg: 30,   label: 'un labrador',         plural: 'labradors' },
  { kg: 60,   label: 'une personne adulte', plural: 'personnes adultes' },
];

/** La plus grosse référence qui tient dans le tonnage, et combien de fois. */
function weightComparison(kg) {
  const ref = [...WEIGHT_REFS].reverse().find(r => kg >= r.kg);
  if (!ref) return null;
  const fois = Math.round(kg / ref.kg);
  // « le poids de 3 chats », « le poids d'un chat »
  return { ref: ref.label, times: fois, text: fois > 1 ? `${fois} ${ref.plural}` : ref.label };
}

/** 9.9 -> « 9,9 kg » */
function kgLabel(kg) {
  return `${String(kg).replace('.', ',')} kg`;
}

/** Fonction pure : données du Wrapped d'une année. null si aucune entrée. */
function buildYearWrapped(logs, year) {
  const toutes = logs || [];
  const an = toutes.filter(l => new Date(l.date).getFullYear() === year);
  if (!an.length) return null;
  const precedente = toutes.filter(l => new Date(l.date).getFullYear() === year - 1).length;

  const mois = {}, heures = {}, jours = {}, tex = {}, lieux = {}, parJour = {};
  an.forEach(l => {
    const d = new Date(l.date);
    mois[d.getMonth()] = (mois[d.getMonth()] || 0) + 1;
    heures[d.getHours()] = (heures[d.getHours()] || 0) + 1;
    jours[d.getDay()] = (jours[d.getDay()] || 0) + 1;
    if (l.texture) tex[l.texture] = (tex[l.texture] || 0) + 1;
    if (l.place) lieux[l.place] = (lieux[l.place] || 0) + 1;
    const cle = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    parJour[cle] = (parJour[cle] || 0) + 1;
  });
  const bestMonth = topEntry(mois), peak = topEntry(heures), dow = topEntry(jours);
  const favTex = topEntry(tex), place = topEntry(lieux), bestDay = topEntry(parJour);
  const duree = typeof durationStats === 'function' ? durationStats(an) : null;
  const premier = an.reduce((a, b) => (b.date < a.date ? b : a));
  const kg = +(an.length * 0.15).toFixed(1);

  return {
    year,
    total: an.length,
    kg,
    weight: weightComparison(kg),
    activeDays: Object.keys(parJour).length,
    firstDate: premier.date,
    bestMonth: bestMonth ? { month: Number(bestMonth.key), count: bestMonth.count } : null,
    peakHour: peak ? Number(peak.key) : null,
    bestWeekday: dow ? Number(dow.key) : null,
    favTexture: favTex ? { id: favTex.key, count: favTex.count, pct: Math.round(favTex.count / an.length * 100) } : null,
    normalPct: Math.round((tex.normal || 0) / an.length * 100),
    bestRun: longestRun(an),
    bestDay: bestDay ? { date: new Date(...bestDay.key.split('-').map(Number)).getTime(), count: bestDay.count } : null,
    topPlace: place ? { id: place.key, count: place.count } : null,
    duration: duree ? { count: duree.count, total: duree.total, max: duree.max, avg: duree.avg } : null,
    previousYear: precedente ? { total: precedente, diff: an.length - precedente } : null,
  };
}

// ===================================================
//  IMAGE FORMAT STORY 📸
// ===================================================
function cssVar(nom, repli) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
    return v || repli;
  } catch { return repli; }
}

/** L'image SVG de la mascotte, chargée pour être dessinée dans un canvas. */
function loadMascotImage(mood, accessory) {
  return new Promise(resolve => {
    const svg = mascotSVG(mood, accessory).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" ');
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/**
 * Dessine une story : titre, grand chiffre, tuiles, mascotte. `tuiles` :
 * [{ emoji, label, value }] (4 maximum).
 */
async function drawStory({ titre, sousTitre, grand, grandLabel, tuiles, mood = 'party', accessory = 'none', phrase = '' }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const police = '"Fredoka", "Segoe UI", system-ui, sans-serif';

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, cssVar('--header-from', '#d97706'));
  grad.addColorStop(1, cssVar('--header-to', '#ec4899'));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Confettis discrets en fond
  const couleurs = ['rgba(255,255,255,.18)', 'rgba(255,255,255,.1)', 'rgba(0,0,0,.06)'];
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = couleurs[i % couleurs.length];
    const x = (i * 263) % W, y = (i * 419) % H, r = 8 + (i * 7) % 22;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = `700 64px ${police}`;
  ctx.fillText(titre, W / 2, 190);
  ctx.globalAlpha = 0.85;
  ctx.font = `500 40px ${police}`;
  ctx.fillText(sousTitre, W / 2, 255);
  ctx.globalAlpha = 1;

  const mascotte = await loadMascotImage(mood, accessory);
  if (mascotte) ctx.drawImage(mascotte, W / 2 - 220, 300, 440, 440);

  ctx.font = `700 260px ${police}`;
  ctx.fillText(String(grand), W / 2, 1000);
  ctx.font = `600 54px ${police}`;
  ctx.fillText(grandLabel, W / 2, 1075);

  if (phrase) {
    ctx.globalAlpha = 0.9;
    ctx.font = `500 40px ${police}`;
    ctx.fillText(phrase, W / 2, 1145);
    ctx.globalAlpha = 1;
  }

  const tw = 450, th = 230, gx = 60, gy = 1220;
  (tuiles || []).slice(0, 4).forEach((t, i) => {
    const x = gx + (i % 2) * (tw + 60), y = gy + Math.floor(i / 2) * (th + 40);
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    roundRect(ctx, x, y, tw, th, 40); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `64px ${police}`;
    ctx.fillText(t.emoji, x + tw / 2, y + 80);
    ctx.font = `700 60px ${police}`;
    ctx.fillText(String(t.value), x + tw / 2, y + 155);
    ctx.globalAlpha = 0.85;
    ctx.font = `500 34px ${police}`;
    ctx.fillText(t.label, x + tw / 2, y + 205);
    ctx.globalAlpha = 1;
  });

  ctx.globalAlpha = 0.7;
  ctx.font = `600 36px ${police}`;
  ctx.fillText('💩 Caca-Tracker 3000 Deluxe', W / 2, H - 80);
  ctx.globalAlpha = 1;
  return canvas;
}

async function shareCanvas(canvas, nomFichier, titre) {
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  if (!blob) return;
  const file = new File([blob], nomFichier, { type: 'image/png' });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ title: titre, files: [file] }); return; }
    catch (e) { if (e?.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nomFichier;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function heureLabel(h) { return h === null ? '—' : `${String(h).padStart(2, '0')} h`; }

async function sharePeriodStory(period) {
  const d = shareCardData(state.logs, period);
  if (!d.total) { window.UI.toast('Aucun caca sur cette période, rien à partager.', 'info'); return; }
  const { current, pending } = streakDetails();
  const m = mascotMood(state.logs);
  const tuiles = [
    { emoji: '📅', label: 'jours actifs', value: d.activeDays },
    { emoji: '🔥', label: 'série actuelle', value: `${current || pending} j` },
    { emoji: TEXTURE_EMOJI_FR[d.topTexture] || '💩', label: 'texture signature', value: TEXTURE_LABELS_FR[d.topTexture] || '—' },
    d.avgDuration
      ? { emoji: '⏱️', label: 'durée moyenne', value: formatDuration(d.avgDuration) }
      : { emoji: '🕐', label: 'heure de pointe', value: heureLabel(d.peakHour) },
  ];
  const poids = weightComparison(d.kg);
  const canvas = await drawStory({
    titre: d.label,
    sousTitre: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
    grand: d.total,
    grandLabel: `caca${d.total > 1 ? 's' : ''} · ${kgLabel(d.kg)}`,
    phrase: poids ? `le poids de ${poids.text}` : '',
    tuiles,
    mood: 'party',
    accessory: m.accessory,
  });
  await shareCanvas(canvas, `caca-${period}.png`, d.label + ' 💩');
}

window.openShareChooser = async function() {
  if (!state.logs.length) { window.UI.toast('Ajoute un caca avant de partager !', 'info'); return; }
  const choix = await window.UI.choose({
    title: '📤 Partager en image',
    message: 'Une image au format story, prête pour Insta, Snap ou WhatsApp.',
    options: [
      { value: 'week',  label: '📆 Ma semaine' },
      { value: 'month', label: '🗓️ Mon mois' },
      { value: 'year',  label: '🎉 Mon année' },
    ],
  });
  if (choix) sharePeriodStory(choix === 'year' ? new Date().getFullYear() : choix);
};

// ===================================================
//  CACA WRAPPED 🎬 (écrans successifs)
// ===================================================
const WRAPPED_SLIDE_MS = 6000;
let _wrapped = null;   // { slides, index, timer, data }

function wrappedSlides(w) {
  const lieu = w.topPlace ? window.PoopMapModule?.placeMeta(w.topPlace.id) : null;
  const slides = [
    { cls: 'wr-s1', html: `
        <div class="wr-kicker">Ton</div>
        <div class="wr-big-title">Caca Wrapped</div>
        <div class="wr-year">${w.year}</div>
        <div class="wr-mascot">${mascotSVG('party', 'crown')}</div>
        <div class="wr-hint">Touche l'écran pour avancer</div>` },
    { cls: 'wr-s2', html: `
        <div class="wr-kicker">Cette année, tu as fait</div>
        <div class="wr-num">${w.total}</div>
        <div class="wr-unit">caca${w.total > 1 ? 's' : ''}</div>
        <div class="wr-line">soit <strong>${kgLabel(w.kg)}</strong>${w.weight ? `, le poids de ${esc(w.weight.text)}` : ''}.</div>` },
    { cls: 'wr-s3', html: `
        <div class="wr-kicker">Ton rythme</div>
        <div class="wr-num">${w.activeDays}</div>
        <div class="wr-unit">jour${w.activeDays > 1 ? 's' : ''} actif${w.activeDays > 1 ? 's' : ''}</div>
        ${w.bestMonth ? `<div class="wr-line">Ton mois le plus productif : <strong>${MOIS_COURTS[w.bestMonth.month]}</strong>, avec ${w.bestMonth.count} cacas.</div>` : ''}` },
    { cls: 'wr-s4', html: `
        <div class="wr-kicker">Ton horloge interne</div>
        <div class="wr-num">${heureLabel(w.peakHour)}</div>
        <div class="wr-unit">ton heure de pointe</div>
        ${w.bestWeekday !== null ? `<div class="wr-line">Et ton jour préféré : le <strong>${JOURS_LONGS[w.bestWeekday]}</strong>.</div>` : ''}` },
  ];
  if (w.favTexture) slides.push({ cls: 'wr-s5', html: `
        <div class="wr-kicker">Ta texture signature</div>
        <div class="wr-emoji">${TEXTURE_EMOJI_FR[w.favTexture.id] || '💩'}</div>
        <div class="wr-unit">${TEXTURE_LABELS_FR[w.favTexture.id] || esc(w.favTexture.id)}</div>
        <div class="wr-line">${w.favTexture.pct} % de tes cacas. Côté santé, <strong>${w.normalPct} %</strong> de « normal ».</div>` });
  slides.push({ cls: 'wr-s6', html: `
        <div class="wr-kicker">Ton record de régularité</div>
        <div class="wr-num">${w.bestRun}</div>
        <div class="wr-unit">jour${w.bestRun > 1 ? 's' : ''} d'affilée</div>
        ${w.bestDay && w.bestDay.count > 1 ? `<div class="wr-line">Et une journée à <strong>${w.bestDay.count} cacas</strong>, le ${new Date(w.bestDay.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.</div>` : ''}` });
  if (lieu) slides.push({ cls: 'wr-s7', html: `
        <div class="wr-kicker">Ton trône préféré</div>
        <div class="wr-emoji">${lieu.emoji}</div>
        <div class="wr-unit">${esc(lieu.label)}</div>
        <div class="wr-line">${w.topPlace.count} fois cette année.</div>` });
  if (w.duration) slides.push({ cls: 'wr-s8', html: `
        <div class="wr-kicker">Temps passé sur le trône</div>
        <div class="wr-num wr-num-sm">${formatDuration(w.duration.total)}</div>
        <div class="wr-unit">sur ${w.duration.count} séance${w.duration.count > 1 ? 's' : ''} chronométrée${w.duration.count > 1 ? 's' : ''}</div>
        <div class="wr-line">Record : <strong>${formatDuration(w.duration.max)}</strong>. Moyenne : ${formatDuration(w.duration.avg)}.</div>` });
  if (w.previousYear) {
    const plus = w.previousYear.diff >= 0;
    slides.push({ cls: 'wr-s9', html: `
        <div class="wr-kicker">Par rapport à ${w.year - 1}</div>
        <div class="wr-num">${plus ? '+' : ''}${w.previousYear.diff}</div>
        <div class="wr-unit">caca${Math.abs(w.previousYear.diff) > 1 ? 's' : ''}</div>
        <div class="wr-line">${plus ? 'Ça progresse !' : 'Une année plus calme.'} (${w.previousYear.total} l'an dernier)</div>` });
  }
  slides.push({ cls: 'wr-s10', outro: true, html: `
        <div class="wr-kicker">C'était ton année ${w.year}</div>
        <div class="wr-mascot">${mascotSVG('happy', 'glasses')}</div>
        <div class="wr-recap">
          <div><strong>${w.total}</strong> cacas</div>
          <div><strong>${w.activeDays}</strong> jours actifs</div>
          <div><strong>${w.bestRun}</strong> j de série</div>
        </div>
        <button type="button" class="wr-share" data-wr="share">📤 Partager mon Wrapped</button>
        <button type="button" class="wr-replay" data-wr="replay">↺ Revoir</button>` });
  return slides;
}

function renderWrappedSlide() {
  const w = _wrapped;
  if (!w) return;
  const scene = $id('wrapped-content');
  const barres = $id('wrapped-progress');
  const slide = w.slides[w.index];
  scene.className = 'wr-scene ' + slide.cls;
  scene.innerHTML = `<div class="wr-slide">${slide.html}</div>`;
  barres.innerHTML = w.slides.map((_, i) =>
    `<div class="wr-bar"><div class="wr-bar-fill${i < w.index ? ' done' : i === w.index ? ' run' : ''}" style="--wr-ms:${WRAPPED_SLIDE_MS}ms"></div></div>`).join('');
  clearTimeout(w.timer);
  if (!slide.outro) w.timer = setTimeout(() => stepWrapped(1), WRAPPED_SLIDE_MS);
}

function stepWrapped(delta) {
  const w = _wrapped;
  if (!w) return;
  const j = w.index + delta;
  if (j < 0 || j >= w.slides.length) return;
  w.index = j;
  renderWrappedSlide();
}

function closeYearWrapped() {
  if (_wrapped) clearTimeout(_wrapped.timer);
  _wrapped = null;
  $id('wrapped-modal')?.classList.add('hidden');
  document.body.style.overflow = '';
}

async function shareYearWrapped(w) {
  const lieu = w.topPlace ? window.PoopMapModule?.placeMeta(w.topPlace.id) : null;
  const tuiles = [
    { emoji: '📅', label: 'jours actifs', value: w.activeDays },
    { emoji: '🔥', label: 'record de série', value: `${w.bestRun} j` },
    { emoji: '🕐', label: 'heure de pointe', value: heureLabel(w.peakHour) },
    lieu ? { emoji: lieu.emoji, label: 'trône préféré', value: lieu.label }
         : { emoji: TEXTURE_EMOJI_FR[w.favTexture?.id] || '💩', label: 'texture signature', value: TEXTURE_LABELS_FR[w.favTexture?.id] || '—' },
  ];
  const canvas = await drawStory({
    titre: 'Mon Caca Wrapped',
    sousTitre: String(w.year),
    grand: w.total,
    grandLabel: `caca${w.total > 1 ? 's' : ''} · ${kgLabel(w.kg)}`,
    phrase: w.weight ? `le poids de ${w.weight.text}` : '',
    tuiles,
    mood: 'party',
    accessory: 'crown',
  });
  await shareCanvas(canvas, `caca-wrapped-${w.year}.png`, `Mon Caca Wrapped ${w.year} 💩`);
}

window.openYearWrapped = function(year) {
  const annee = year || (typeof wrappedSeason === 'function' && wrappedSeason()) || new Date().getFullYear();
  const data = buildYearWrapped(state.logs, annee);
  const modal = $id('wrapped-modal');
  if (!modal) return;
  if (!data) {
    window.UI.toast(`Aucun caca en ${annee} : ton Wrapped est vide !`, 'info');
    return;
  }
  _wrapped = { data, slides: wrappedSlides(data), index: 0, timer: null };
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  renderWrappedSlide();
};

function setupWrapped() {
  const modal = $id('wrapped-modal');
  if (!modal) return;
  $id('close-wrapped-btn')?.addEventListener('click', closeYearWrapped);
  $id('wrapped-content')?.addEventListener('click', e => {
    const action = e.target.closest('[data-wr]')?.dataset.wr;
    if (action === 'share') { shareYearWrapped(_wrapped.data); return; }
    if (action === 'replay') { _wrapped.index = 0; renderWrappedSlide(); return; }
    // Tiers gauche : écran précédent. Le reste : suivant (comme les stories).
    const rect = e.currentTarget.getBoundingClientRect();
    stepWrapped(e.clientX - rect.left < rect.width / 3 ? -1 : 1);
  });
  document.addEventListener('keydown', e => {
    if (!_wrapped) return;
    if (e.key === 'Escape') closeYearWrapped();
    if (e.key === 'ArrowRight') stepWrapped(1);
    if (e.key === 'ArrowLeft') stepWrapped(-1);
  });
}
