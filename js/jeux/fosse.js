// ============================================================
//  fosse.js — Fosse septique tycoon 🌻
//  Pas un jeu pour la séance : un jardin qui pousse avec le temps.
//  Chaque caca enregistré rapporte de l'engrais, les séances de jeu
//  finies à temps (« sorties dignes ») aussi. On plante dans l'ordre,
//  et on récolte une fois par jour.
//  L'engrais gagné se recalcule depuis l'historique : rien à tricher
//  ni à synchroniser, seuls les achats et récoltes sont stockés.
//  Logique pure testée : test/jeux-quiz-fosse.test.js
// ============================================================

const FOSSE_ITEMS = [
  { id: 'lombrics',   emoji: '🪱', nom: 'Lombrics',        cout: 50,   desc: 'Ils transforment tout en terreau.' },
  { id: 'semis',      emoji: '🌱', nom: 'Semis',           cout: 100,  desc: 'Ça pousse, doucement.' },
  { id: 'carottes',   emoji: '🥕', nom: 'Carottes',        cout: 180,  desc: 'Des fibres, pour la suite.' },
  { id: 'tournesols', emoji: '🌻', nom: 'Tournesols',      cout: 300,  desc: 'Toujours tournés vers le trône.' },
  { id: 'tomates',    emoji: '🍅', nom: 'Tomates',         cout: 450,  desc: 'Bien rouges, bien juteuses.' },
  { id: 'ruche',      emoji: '🐝', nom: 'Ruche',           cout: 650,  desc: 'Les abeilles adorent l\'odeur.' },
  { id: 'pommier',    emoji: '🌳', nom: 'Pommier',         cout: 900,  desc: 'Une pomme par jour…' },
  { id: 'mare',       emoji: '🦆', nom: 'Mare aux canards', cout: 1250, desc: 'Coin coin.' },
  { id: 'cabane',     emoji: '🏡', nom: 'Cabane au fond du jardin', cout: 1700, desc: 'Avec toilettes sèches, évidemment.' },
  { id: 'station',    emoji: '🌈', nom: 'Station d\'épuration arc-en-ciel', cout: 2400, desc: 'Le chef-d\'œuvre final.' },
];

const FOSSE_GAIN = { PAR_CACA: 10, BONUS_NORMAL: 5, PAR_JOUR: 5, PAR_SORTIE_DIGNE: 20, RECOLTE_PAR_PLANTE: 5 };

function fosseDebutJour(now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Engrais gagné par l'historique et les sorties dignes. */
function fosseGain(logs, sortiesDignes = 0) {
  const liste = logs || [];
  const jours = new Set(liste.map(l => new Date(l.date).toDateString()));
  return liste.length * FOSSE_GAIN.PAR_CACA
    + liste.filter(l => l.texture === 'normal').length * FOSSE_GAIN.BONUS_NORMAL
    + jours.size * FOSSE_GAIN.PAR_JOUR
    + Math.max(0, sortiesDignes) * FOSSE_GAIN.PAR_SORTIE_DIGNE;
}

function fosseState(logs, stats, now = Date.now()) {
  const s = window.JeuxCore.normalizeGameStats(stats);
  // Seuls les achats connus et faits dans l'ordre comptent.
  const owned = [];
  for (const item of FOSSE_ITEMS) { if (s.fosse.owned.includes(item.id)) owned.push(item.id); else break; }
  const gagne = fosseGain(logs, s.sortiesDignes) + s.fosse.harvested;
  const depense = FOSSE_ITEMS.filter(i => owned.includes(i.id)).reduce((a, i) => a + i.cout, 0);
  const solde = gagne - depense;
  const next = FOSSE_ITEMS.find(i => !owned.includes(i.id)) || null;
  const recolteMontant = owned.length * FOSSE_GAIN.RECOLTE_PAR_PLANTE;
  return {
    gagne, depense, solde, owned, next,
    peutAcheter: !!next && solde >= next.cout,
    manque: next ? Math.max(0, next.cout - solde) : 0,
    recolteMontant,
    recolteDispo: recolteMontant > 0 && s.fosse.lastHarvest < fosseDebutJour(now),
    complet: !next,
  };
}

/** Achète la plante suivante. Rend { ok, stats, item, reason }. */
function fosseBuy(stats, logs, now = Date.now()) {
  const s = window.JeuxCore.normalizeGameStats(stats);
  const st = fosseState(logs, s, now);
  if (!st.next) return { ok: false, stats: s, item: null, reason: 'complet' };
  if (!st.peutAcheter) return { ok: false, stats: s, item: st.next, reason: 'engrais' };
  s.fosse.owned = [...st.owned, st.next.id];
  return { ok: true, stats: s, item: st.next, reason: null };
}

/** Récolte du jour. Rend { ok, stats, gain }. */
function fosseHarvest(stats, logs, now = Date.now()) {
  const s = window.JeuxCore.normalizeGameStats(stats);
  const st = fosseState(logs, s, now);
  if (!st.recolteDispo) return { ok: false, stats: s, gain: 0 };
  s.fosse.harvested += st.recolteMontant;
  s.fosse.lastHarvest = now;
  return { ok: true, stats: s, gain: st.recolteMontant };
}

function fosseCreate(env) {
  const stage = env.stage;

  function render() {
    const stats = env.getStats();
    const st = fosseState(env.getLogs(), stats);
    const parcelles = FOSSE_ITEMS.map(i => {
      const a = st.owned.includes(i.id);
      return `<div class="fosse-plot${a ? ' on' : ''}" title="${a ? i.nom : 'À planter'}"><span aria-hidden="true">${a ? i.emoji : '🟫'}</span></div>`;
    }).join('');
    stage.innerHTML = `
      <div class="fosse">
        <div class="fosse-solde"><span class="fosse-solde-num">${st.solde}</span> <span>💩 d'engrais</span></div>
        <div class="fosse-garden" aria-label="${st.owned.length} plantation${st.owned.length > 1 ? 's' : ''} sur ${FOSSE_ITEMS.length}">${parcelles}</div>
        ${st.recolteDispo
          ? `<button type="button" class="fosse-btn fosse-harvest" data-act="harvest">🧺 Récolter +${st.recolteMontant}</button>`
          : st.recolteMontant ? '<p class="fosse-note">🧺 Récolte faite aujourd\'hui, reviens demain.</p>' : ''}
        ${st.next ? `
          <div class="fosse-next">
            <div class="fosse-next-emoji" aria-hidden="true">${st.next.emoji}</div>
            <div class="fosse-next-txt">
              <div class="fosse-next-nom">${st.next.nom}</div>
              <div class="fosse-next-desc">${st.next.desc}</div>
            </div>
            <button type="button" class="fosse-btn" data-act="buy"${st.peutAcheter ? '' : ' disabled'}>
              ${st.peutAcheter ? `Planter · ${st.next.cout}` : `Encore ${st.manque}`}
            </button>
          </div>` : '<p class="fosse-note fosse-fin">🌈 Jardin terminé. Tu es la reine de l\'épuration.</p>'}
        <p class="fosse-note">Engrais : +${FOSSE_GAIN.PAR_CACA} par caca (+${FOSSE_GAIN.BONUS_NORMAL} s'il est normal), +${FOSSE_GAIN.PAR_JOUR} par jour actif, +${FOSSE_GAIN.PAR_SORTIE_DIGNE} par séance de jeu bouclée en moins de 8 minutes.</p>
      </div>`;
    stage.querySelector('[data-act="buy"]')?.addEventListener('click', () => {
      const r = fosseBuy(env.getStats(), env.getLogs());
      if (!r.ok) return;
      env.setStats(r.stats);
      env.haptic([10, 30, 10]);
      env.toast(`${r.item.emoji} ${r.item.nom} : c'est planté !`);
      render();
    });
    stage.querySelector('[data-act="harvest"]')?.addEventListener('click', () => {
      const r = fosseHarvest(env.getStats(), env.getLogs());
      if (!r.ok) return;
      env.setStats(r.stats);
      env.haptic(12);
      env.toast(`🧺 +${r.gain} d'engrais`);
      render();
    });
  }
  render();

  return { dom: true, idle: true, hint: '', update() {} };
}

window.JeuFosse = { FOSSE_ITEMS, FOSSE_GAIN, fosseGain, fosseState, fosseBuy, fosseHarvest, create: fosseCreate };
