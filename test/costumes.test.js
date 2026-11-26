// Économie de « Rouleaux d'Or » 🧻 & Garde-robe SVG de la mascotte (v3.0).

const test = require('node:test');
const assert = require('node:assert');
const { loadInto, readGlobals, daysAgo } = require('./helpers/load');

function makeEnv(extra = {}) {
  const ctx = loadInto(
    ['js/app/app-render.js', 'js/app/app-sante.js', 'js/app/app-costumes.js', 'js/app/app-accueil.js'],
    {
      state: { logs: [] },
      $id: () => null,
      $debug: () => {},
      esc: String,
      textureEmoji: () => '💩',
      renderDashboard: () => {},
      renderHistory: () => {},
      updateBadges: () => {},
      updateChart: () => {},
      ...extra,
    }
  );
  const g = readGlobals(ctx, [
    'WARDROBE_STORAGE_KEY',
    'MASCOT_COSTUMES',
    'costumeMeta',
    'loadWardrobe',
    'computeEarnedRolls',
    'isCostumeUnlocked',
    'getAvailableRolls',
    'buyCostume',
    'equipCostume',
    'resolveActiveAccessory',
    'cycleMascotCostume',
    'renderWardrobePanel',
    'mascotSVG',
    'mascotMood',
    'renderHomeCard',
    'setupHome',
    'dailyQuests',
    'throneStage',
  ]);
  return { ctx, g };
}

const makeLogs = n => Array.from({ length: n }, (_, i) => ({
  id: i + 1,
  date: daysAgo(i),
  texture: 'normal',
  color: 'marron',
}));

// ---------- Catalogue ----------

test('MASCOT_COSTUMES : contient les 8 costumes attendus avec coûts et paliers exacts', () => {
  const { g } = makeEnv();
  assert.strictEqual(g.MASCOT_COSTUMES.length, 8);
  const byId = Object.fromEntries(g.MASCOT_COSTUMES.map(c => [c.id, c]));

  assert.strictEqual(byId.none.name, 'Naturel');
  assert.strictEqual(byId.none.emoji, '💩');
  assert.strictEqual(byId.none.cost, 0);

  assert.strictEqual(byId.glasses.name, 'Lunettes Star');
  assert.strictEqual(byId.glasses.emoji, '🕶️');
  assert.strictEqual(byId.glasses.cost, 30);
  assert.strictEqual(byId.glasses.freeStreak, 7);

  assert.strictEqual(byId.crown.name, 'Couronne Royale');
  assert.strictEqual(byId.crown.emoji, '👑');
  assert.strictEqual(byId.crown.cost, 80);
  assert.strictEqual(byId.crown.freeStreak, 30);

  assert.strictEqual(byId.beret.cost, 40);
  assert.strictEqual(byId.headphones.cost, 50);
  assert.strictEqual(byId.flowers.cost, 45);
  assert.strictEqual(byId.chef.cost, 60);
  assert.strictEqual(byId.wizard.cost, 90);
});

// ---------- Calcul des Rouleaux d'Or 🧻 ----------

test('computeEarnedRolls : applique (logs*5) + (floor(bestStreak/7)*15) + (gamesPlayed*2)', () => {
  const { g } = makeEnv();
  assert.strictEqual(g.computeEarnedRolls(), 0);
  assert.strictEqual(g.computeEarnedRolls([], 0, 0), 0);
  assert.strictEqual(g.computeEarnedRolls(makeLogs(4), 6, 3), 4 * 5 + 0 + 3 * 2);
  assert.strictEqual(g.computeEarnedRolls(makeLogs(10), 7, 5), 50 + 15 + 10);
  assert.strictEqual(g.computeEarnedRolls(makeLogs(2), 14, 0), 10 + 30 + 0);
  assert.strictEqual(g.computeEarnedRolls(makeLogs(1), 30, 4), 5 + 60 + 8);
  assert.strictEqual(g.computeEarnedRolls(null, -5, -3), 0);
});

// ---------- Déblocages & Achats ----------

test('isCostumeUnlocked : gratuit à cost=0 ou par freeStreak, sinon verrouillé avant achat', () => {
  const { g } = makeEnv();
  assert.strictEqual(g.isCostumeUnlocked('none', 0), true);
  assert.strictEqual(g.isCostumeUnlocked('glasses', 6), false);
  assert.strictEqual(g.isCostumeUnlocked('glasses', 7), true);
  assert.strictEqual(g.isCostumeUnlocked('crown', 29), false);
  assert.strictEqual(g.isCostumeUnlocked('crown', 30), true);
  assert.strictEqual(g.isCostumeUnlocked('beret', 100), false);
  assert.strictEqual(g.isCostumeUnlocked('wizard', 100), false);
  assert.strictEqual(g.isCostumeUnlocked('inconnu', 100), false);
});

test('buyCostume & getAvailableRolls : achat valide, solde insuffisant, doublon et solde jamais négatif', () => {
  const { ctx, g } = makeEnv();
  const logs10 = makeLogs(10); // 10 * 5 = 50 🧻

  assert.strictEqual(g.getAvailableRolls(logs10, 0, 0), 50);

  // Trop cher (wizard = 90 🧻)
  const fail = g.buyCostume('wizard', logs10, 0, 0);
  assert.strictEqual(fail.ok, false);
  assert.strictEqual(fail.remaining, 50);
  assert.strictEqual(fail.reason, 'not_enough_rolls');
  assert.strictEqual(g.isCostumeUnlocked('wizard', 0), false);

  // Achat valide (beret = 40 🧻)
  const ok = g.buyCostume('beret', logs10, 0, 0);
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.remaining, 10);
  assert.strictEqual(g.isCostumeUnlocked('beret', 0), true);
  assert.strictEqual(g.getAvailableRolls(logs10, 0, 0), 10);

  // Persistance dans localStorage sous 'mascot.wardrobe.v1'
  const saved = JSON.parse(ctx.localStorage.getItem('mascot.wardrobe.v1'));
  assert.ok(saved.unlocked.includes('none'));
  assert.ok(saved.unlocked.includes('beret'));
  assert.strictEqual(saved.equipped, 'auto');

  // Achat en double refusé sans re-débiter
  const dup = g.buyCostume('beret', logs10, 0, 0);
  assert.strictEqual(dup.ok, false);
  assert.strictEqual(dup.reason, 'already_unlocked');
  assert.strictEqual(dup.remaining, 10);

  // Costume déjà offert par la série (glasses à 7j) : refusé sans débiter
  const freeByStreak = g.buyCostume('glasses', logs10, 7, 0);
  assert.strictEqual(freeByStreak.ok, false);
  assert.strictEqual(freeByStreak.reason, 'already_unlocked');

  // Costume inconnu
  const unknown = g.buyCostume('alien', logs10, 0, 0);
  assert.strictEqual(unknown.ok, false);
  assert.strictEqual(unknown.reason, 'unknown_costume');

  // Si des logs sont supprimés ensuite (earned < spent), le solde reste >= 0
  assert.strictEqual(g.getAvailableRolls(makeLogs(2), 0, 0), 0);
});

test('loadWardrobe : tolère un JSON corrompu dans localStorage', () => {
  const { ctx, g } = makeEnv();
  ctx.localStorage.setItem('mascot.wardrobe.v1', '{pas-du-json');
  const w = g.loadWardrobe();
  assert.strictEqual(w.equipped, 'auto');
  assert.deepStrictEqual([...w.unlocked], ['none']);
});

// ---------- Équipement, résolution & cycle ----------

test('equipCostume & resolveActiveAccessory : mode auto vs costume choisi', () => {
  const { g } = makeEnv();
  const logs20 = makeLogs(20); // 100 🧻

  // Par défaut ('auto') : suit l'accessoire automatique
  assert.strictEqual(g.resolveActiveAccessory('none', 0), 'none');
  assert.strictEqual(g.resolveActiveAccessory('glasses', 7), 'glasses');
  assert.strictEqual(g.resolveActiveAccessory('crown', 30), 'crown');

  // Impossible d'équiper un costume verrouillé
  assert.strictEqual(g.equipCostume('chef', 0), false);

  // Achat puis équipement de 'chef'
  assert.strictEqual(g.buyCostume('chef', logs20, 0, 0).ok, true);
  assert.strictEqual(g.equipCostume('chef', 0), true);
  assert.strictEqual(g.resolveActiveAccessory('crown', 30), 'chef');

  // Forcer 'none' même avec une série de 30 jours
  assert.strictEqual(g.equipCostume('none', 30), true);
  assert.strictEqual(g.resolveActiveAccessory('crown', 30), 'none');

  // Retour en mode 'auto'
  assert.strictEqual(g.equipCostume('auto'), true);
  assert.strictEqual(g.resolveActiveAccessory('crown', 30), 'crown');
});

test('cycleMascotCostume : fait défiler uniquement les costumes débloqués', () => {
  const { g } = makeEnv();

  // Un seul costume débloqué ('none') : reste sur 'none' et conserve 'auto'
  assert.strictEqual(g.cycleMascotCostume(0), 'none');
  assert.strictEqual(g.loadWardrobe().equipped, 'auto');

  // Débloque 'beret' et 'flowers' + série de 7j ('glasses')
  const logs30 = makeLogs(30);
  g.buyCostume('beret', logs30, 0, 0);
  g.buyCostume('flowers', logs30, 0, 0);

  // Ordre du catalogue parmi les débloqués à bestStreak=7 : none -> glasses -> beret -> flowers
  assert.strictEqual(g.cycleMascotCostume(7), 'glasses');
  assert.strictEqual(g.cycleMascotCostume(7), 'beret');
  assert.strictEqual(g.cycleMascotCostume(7), 'flowers');
  assert.strictEqual(g.cycleMascotCostume(7), 'none');
  assert.strictEqual(g.cycleMascotCostume(7), 'glasses');
});

// ---------- Rendu SVG des 8 costumes ----------

test('mascotSVG : génère des SVG valides et distincts pour les 8 costumes et 5 humeurs', () => {
  const { g } = makeEnv();
  const moods = ['happy', 'party', 'sleepy', 'worried', 'waiting'];
  const costumes = g.MASCOT_COSTUMES.map(c => c.id);

  for (const mood of moods) {
    const seenForMood = new Set();
    for (const acc of costumes) {
      const svg = g.mascotSVG(mood, acc);
      assert.ok(svg.includes('<svg') && svg.includes('</svg>'), `SVG manquant pour ${mood}/${acc}`);
      assert.ok(!svg.includes('var(--'), `Pas de variable CSS dans le SVG standalone (${mood}/${acc})`);
      const openG = (svg.match(/<g\b/g) || []).length;
      const closeG = (svg.match(/<\/g>/g) || []).length;
      assert.strictEqual(openG, closeG, `Balises <g> équilibrées pour ${mood}/${acc}`);
      if (mood !== 'sleepy') seenForMood.add(svg);
    }
    if (mood !== 'sleepy') {
      assert.strictEqual(seenForMood.size, 8, `Les 8 costumes doivent être visuellement distincts (${mood})`);
    }
  }

  // Lunettes : remplacent les yeux sauf quand elle dort
  assert.ok(g.mascotSVG('happy', 'glasses').includes('width="24" height="15"'));
  assert.ok(!g.mascotSVG('sleepy', 'glasses').includes('width="24" height="15"'));
});

// ---------- Intégration DOM (Accueil & Garde-robe) ----------

test('renderHomeCard, setupHome et renderWardrobePanel mettent à jour le DOM et gèrent le clic mascotte', () => {
  const listeners = {};
  const mascotSvgStub = {
    classList: {
      removed: false,
      added: false,
      remove(c) { if (c === 'mascot-jump') this.removed = true; },
      add(c) { if (c === 'mascot-jump') this.added = true; },
    },
    getBoundingClientRect: () => ({}),
  };
  const elements = {
    'mascot': {
      innerHTML: '',
      addEventListener: (ev, fn) => { listeners.mascotClick = fn; },
      querySelector: sel => (sel === '.mascot-svg' ? mascotSvgStub : null),
    },
    'home-rolls-badge': { textContent: '' },
    'mascot-costume-label': { textContent: '' },
    'mascot-message': { textContent: '' },
    'mascot-level': { innerHTML: '' },
    'wardrobe-container': {
      innerHTML: '',
      addEventListener: (ev, fn) => { listeners.wardrobeClick = fn; },
    },
  };

  const logs12 = makeLogs(12); // 12 jours consécutifs -> 12*5 + 15 = 75 🧻, glasses gratuit (7j)
  const { g } = makeEnv({
    state: { logs: logs12 },
    $id: id => elements[id] || null,
  });

  g.setupHome();
  g.renderHomeCard();
  assert.strictEqual(elements['home-rolls-badge'].textContent, '🧻 75');
  assert.strictEqual(elements['mascot-costume-label'].textContent, '🕶️ Lunettes Star');
  assert.ok(elements['mascot'].innerHTML.includes('<svg'));

  // Panneau Garde-robe
  g.renderWardrobePanel();
  assert.ok(elements['wardrobe-container'].innerHTML.includes('Garde-robe de la mascotte'));
  assert.ok(elements['wardrobe-container'].innerHTML.includes('Béret Artiste'));
  assert.ok(elements['wardrobe-container'].innerHTML.includes('Chapeau Magique'));

  // Achat du béret (40 🧻) via délégation de clic dans la garde-robe
  listeners.wardrobeClick({
    target: {
      closest: sel => (sel === '[data-costume-buy]'
        ? { getAttribute: () => 'beret' }
        : null),
    },
  });
  assert.strictEqual(elements['home-rolls-badge'].textContent, '🧻 35');
  assert.strictEqual(elements['mascot-costume-label'].textContent, '🎨 Béret Artiste');
  assert.ok(elements['mascot'].innerHTML.includes('mascot-acc-beret'));

  // Clic sur #mascot : passe au costume débloqué suivant ('none') et déclenche le saut
  listeners.mascotClick();
  assert.strictEqual(elements['mascot-costume-label'].textContent, '💩 Naturel');
  assert.strictEqual(mascotSvgStub.classList.added, true);

  // Clic suivant sur #mascot : passe à 'glasses'
  listeners.mascotClick();
  assert.strictEqual(elements['mascot-costume-label'].textContent, '🕶️ Lunettes Star');
});

// ---------- Quêtes journalières & Trône ----------

test('dailyQuests : retourne 3 quêtes et suit la progression eau, durée et passage', () => {
  const { g } = makeEnv();
  const now = new Date(2026, 4, 15, 14, 0, 0).getTime();
  const yesterday = now - 86400000;

  // Aucun log aujourd'hui (uniquement hier) et eau < 6
  const empty = g.dailyQuests([{ id: 1, date: yesterday, duration: 120 }], 5, now);
  assert.strictEqual(empty.length, 3);
  assert.deepStrictEqual([...empty].map(q => q.id), ['eau', 'duree', 'passage']);
  assert.strictEqual(empty.every(q => q.done === false), true);

  // Passage aujourd'hui sans durée, mais eau >= 6
  const partial = g.dailyQuests([{ id: 2, date: now }], 6, now);
  assert.strictEqual(partial.find(q => q.id === 'eau').done, true);
  assert.strictEqual(partial.find(q => q.id === 'duree').done, false);
  assert.strictEqual(partial.find(q => q.id === 'passage').done, true);

  // Passage aujourd'hui avec durée valide + eau >= 6
  const full = g.dailyQuests([{ id: 3, date: now, duration: 90 }], 8, now);
  assert.strictEqual(full.every(q => q.done === true), true);
});

test('throneStage : retourne le stade évolutif du trône selon le niveau', () => {
  const { g } = makeEnv();
  assert.deepStrictEqual({ ...g.throneStage() }, { emoji: '🪵', label: 'Trône en bois' });
  assert.deepStrictEqual({ ...g.throneStage(2) }, { emoji: '🪵', label: 'Trône en bois' });
  assert.deepStrictEqual({ ...g.throneStage(3) }, { emoji: '🚽', label: 'Porcelaine royale' });
  assert.deepStrictEqual({ ...g.throneStage(5) }, { emoji: '👑', label: 'Trône doré' });
  assert.deepStrictEqual({ ...g.throneStage(7) }, { emoji: '🚀', label: 'Trône spatial' });
  assert.deepStrictEqual({ ...g.throneStage(12) }, { emoji: '🚀', label: 'Trône spatial' });
});
