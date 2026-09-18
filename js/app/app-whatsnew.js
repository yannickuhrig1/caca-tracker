// ============================================================
//  app-whatsnew.js
//  Version de l'app + popup « Quoi de neuf » au premier lancement
//  suivant une mise a jour.
//  Charge apres app-core.js (utilise $id).
// ============================================================

// Source de vérité unique de la version. L'en-tête et les Réglages sont
// remplis à partir d'ici, ce qui évite qu'ils divergent comme par le passé.
const APP_VERSION = '2.21.0';
const APP_VERSION_DATE = 'Septembre 2026';

// De la plus récente à la plus ancienne. `items` reste court et écrit pour
// Clémence, pas pour un développeur : ce que ça change pour elle, pas comment.
const APP_CHANGELOG = [
  {
    version: '2.21.0',
    date: 'Septembre 2026',
    items: [
      ['👤', 'Ton **profil** est rangé en trois onglets : Avatar, Thème et Compte. Fini la longue liste à faire défiler.'],
      ['🤡', '**20 nouveaux avatars** : clown, alien, robot, fantôme, paresseux, pêche, rouleau de PQ, ventouse…'],
      ['✨', '**12 avatars animés** à débloquer en gagnant des badges : la fusée décolle, le volcan tremble, le maïs danse. Les copines les voient bouger dans le groupe.'],
    ]
  },
  {
    version: '2.20.1',
    date: 'Septembre 2026',
    items: [
      ['🌽', 'Le Grand Transit : tu contrôles enfin ta **vitesse**. Monte le pouce pour **freiner**, descends-le pour **foncer**. Freine avant des dents fermées, fonce quand elles s\'ouvrent.'],
      ['🦠', 'Les méchantes bactéries du côlon ne te suivent plus jusqu\'au contact : un écart de dernière seconde suffit à les éviter.'],
      ['🦷', 'Plus d\'espace entre deux molaires dans la bouche.'],
    ]
  },
  {
    version: '2.20.0',
    date: 'Septembre 2026',
    items: [
      ['🌽', '**Le Grand Transit** : tu es un grain de maïs avalé. Glisse le pouce pour éviter les molaires, l\'acide et les bactéries, tape pour durcir ta carapace. Cinq organes : bouche, œsophage, estomac, intestin grêle et côlon.'],
      ['💾', 'La partie est **sauvegardée à l\'entrée de chaque organe** : tu reprends où tu en étais à la séance suivante.'],
      ['⏳', 'Le **vrai test du maïs** : dans Stats, touche « J\'ai mangé du maïs », puis coche « Je vois du maïs » au caca où tu le retrouves. L\'app calcule ton **temps de transit réel**, celui que mesurent les médecins.'],
      ['🏅', '3 nouveaux badges : Le Grand Transit, Ressortie Intacte et Test du Maïs.'],
    ]
  },
  {
    version: '2.19.0',
    date: 'Septembre 2026',
    items: [
      ['🎮', 'Les **Jeux du trône** : Plop!, Tour de PQ, Le Côlon et la Course au trône, pour passer le temps aux toilettes. Bouton 🎮 sur l\'accueil ou à côté du chrono.'],
      ['🕵️', '**Qui a fait ce caca ?** Devine quelle copine a posé le caca du feed.'],
      ['🌻', '**Fosse septique tycoon** : tes cacas deviennent de l\'engrais pour faire pousser un jardin.'],
      ['⏳', 'Les parties s\'arrêtent au bout de **8 minutes** de séance : rester assise trop longtemps, c\'est mauvais pour les fesses. Finir avant, c\'est une **sortie digne**.'],
      ['🏆', 'Classement des jeux de la semaine dans ton groupe, **8 nouveaux badges** et des **stickers à débloquer**.'],
    ]
  },
  {
    version: '2.18.0',
    date: 'Septembre 2026',
    items: [
      ['💩', 'Une **mascotte** t\'accueille : elle change d\'humeur selon ta journée, grandit avec tes cacas et gagne lunettes puis couronne avec ta série.'],
      ['🔥', 'Pas encore de caca aujourd\'hui ? Ta série reste affichée **jusqu\'à minuit** au lieu de retomber à 0.'],
      ['⏱️', 'Le chrono remplit maintenant une vraie **durée** : moyenne et record dans les Stats, badges Express et Marathon, et la **Reine de l\'endurance** dans ton groupe.'],
      ['🩺', 'Nouveau **carnet de santé privé** à la saisie (symptômes, règles, café, épicé…) et un bloc « **Ce que j\'ai remarqué** » dans les Stats.'],
      ['⚡', '« **Comme d\'habitude** » remplit ta saisie en un geste, avec des textures dessinées.'],
      ['📤', 'Partage en **image story** (semaine, mois, année) et **Caca Wrapped** en écrans successifs à la fin de l\'année.'],
      ['🎨', '**Stickers** dans les commentaires, **série du groupe** et **ligue entre groupes**.'],
      ['🏆', 'Badges rangés par catégories, « à portée de main » et paliers de rareté (Rare, Épique, Légendaire…).'],
    ]
  },
  {
    version: '2.17.0',
    date: 'Septembre 2026',
    items: [
      ['📊', 'Les graphiques des Stats sont refaits : heures **lisibles** par créneaux de 2 h, jours de la semaine, et une vraie courbe sur 12 mois.'],
      ['🔀', 'Tu peux **réorganiser les blocs** de l\'onglet Stats : bouton « Réorganiser », puis les flèches ↑ ↓.'],
      ['📅', 'Le bilan bascule entre **année par année** et **mois par mois**.'],
      ['🔬', 'L\'échelle de Bristol comptait chaque caca deux fois : c\'est corrigé, les pourcentages sont enfin justes.'],
      ['🎬', 'Ton année en review a droit à un grand chiffre et des tuiles claires.'],
    ]
  },
  {
    version: '2.16.0',
    date: 'Septembre 2026',
    items: [
      ['📅', 'Le calendrier des Stats devient un **vrai calendrier**, mois par mois : chaque jour affiche ses 💩, et un clic ouvre le détail.'],
      ['‹ ›', 'Les flèches remontent dans le temps, jusqu\'à ton tout premier caca.'],
    ]
  },
  {
    version: '2.15.1',
    date: 'Septembre 2026',
    items: [
      ['📍', 'Pour que ta carte se remplisse : active **« Enregistrer la position »** dans ⚙️ Réglages, puis touche le bouton 📍 en ajoutant un caca.'],
      ['🏴', 'Et « **Retrouver commune et pays** », juste en dessous, pour débloquer les territoires conquis et leurs drapeaux.'],
      ['☁️', 'Tes anciens cacas remontent maintenant tout seuls dans le cloud avec leur lieu — plus besoin de te déconnecter puis reconnecter.'],
    ]
  },
  {
    version: '2.15.0',
    date: 'Septembre 2026',
    items: [
      ['🔎', 'Ton historique est **complet et fouillable** : recherche, filtres, et plus de limite aux 20 derniers.'],
      ['🏴', 'Territoires conquis : communes, régions et pays avec les drapeaux, plus 8 trophées d\'exploration.'],
      ['💎', 'Rareté des badges : tu vois combien de copines ont décroché le même.'],
      ['📊', 'Export tableur (.csv) et bilan année par année dans les Stats.'],
    ]
  },
  {
    version: '2.14.0',
    date: 'Septembre 2026',
    items: [
      ['🗺️', '**PoopMap** : dis où ça s\'est passé (🏠 💼 🏫 🍽️ 👯 🚆 🌳 🚻) et retrouve le classement de tes lieux dans les Stats.'],
      ['📍', 'Si tu l\'actives dans les Réglages, chaque caca peut garder sa position — la carte se remplit toute seule.'],
      ['🧭', '3 nouveaux badges : Exploratrice, Globe-trotteuse et Casanière.'],
    ]
  },
  {
    version: '2.13.0',
    date: 'Août 2026',
    items: [
      ['🆕', 'Cette fenêtre : à chaque mise à jour, tu vois ce qui a changé.'],
      ['👋', 'Une petite présentation s\'affiche à la première ouverture.'],
    ]
  },
  {
    version: '2.12.0',
    date: 'Août 2026',
    items: [
      ['✏️', 'Tu peux enfin **modifier** un caca depuis l\'historique — plus besoin de supprimer puis re-saisir.'],
      ['⚡', 'L\'app se charge nettement plus vite.'],
      ['📷', 'Le QR code d\'invitation refonctionne (il était cassé).'],
      ['🔒', 'Correction d\'une faille : les emails des comptes étaient lisibles publiquement.'],
    ]
  },
  {
    version: '2.11.0',
    date: 'Juillet 2026',
    items: [
      ['💬', 'Commentaires sous les cacas du feed, pour se chambrer.'],
      ['👉', 'Bouton « Relancer » pour réveiller une copine inactive.'],
      ['🏆', 'Hall of Fame des gagnantes et défis hebdo qui changent de thème.'],
      ['👑', 'Couronne de reine du mois et récap de la semaine.'],
    ]
  },
];

const WHATSNEW_KEY = 'cacaTracker.lastSeenVersion';

/** Compare deux versions « x.y.z ». > 0 si a est plus récente que b. */
function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

/** Les entrées strictement plus récentes que la version déjà vue. */
function changelogSince(seen) {
  if (!seen) return [];
  return APP_CHANGELOG.filter(e => compareVersions(e.version, seen) > 0);
}

// N'affiche rien à la toute première ouverture : l'onboarding s'en charge, et
// enchaîner deux fenêtres serait pénible. On note simplement la version.
function maybeShowWhatsNew() {
  if (!$id('whatsnew')) return;
  const seen = localStorage.getItem(WHATSNEW_KEY);

  if (!seen) {
    localStorage.setItem(WHATSNEW_KEY, APP_VERSION);
    return;
  }
  if (compareVersions(APP_VERSION, seen) <= 0) return;

  const nouveautes = changelogSince(seen);
  localStorage.setItem(WHATSNEW_KEY, APP_VERSION);
  if (nouveautes.length) showWhatsNew(nouveautes);
}

function showWhatsNew(entrees) {
  renderWhatsNew(entrees);
  $id('whatsnew').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', whatsNewKeydown);
  $id('whatsnew-close')?.focus();
}

function closeWhatsNew() {
  $id('whatsnew').classList.add('hidden');
  document.body.style.overflow = '';
  document.removeEventListener('keydown', whatsNewKeydown);
}

function whatsNewKeydown(e) {
  if (e.key === 'Escape') closeWhatsNew();
}

// **gras** -> <strong>, sur du texte déjà échappé.
function miniMarkdown(txt) {
  return esc(txt).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function renderWhatsNew(entrees) {
  $id('whatsnew-version').textContent = 'Version ' + entrees[0].version;
  $id('whatsnew-body').innerHTML = entrees.map(e => `
    <div class="space-y-2">
      ${entrees.length > 1 ? `<div class="text-xs font-bold uppercase tracking-widest opacity-40">v${esc(e.version)} — ${esc(e.date)}</div>` : ''}
      ${e.items.map(([emoji, texte]) => `
        <div class="flex items-start gap-3 text-left">
          <span class="text-xl leading-none shrink-0" aria-hidden="true">${esc(emoji)}</span>
          <span class="text-sm opacity-85 leading-relaxed">${miniMarkdown(texte)}</span>
        </div>`).join('')}
    </div>`).join('<div class="my-3" style="border-top:1px solid var(--card-border)"></div>');
}

// Rejouable depuis les Réglages : montre les nouveautés de la version courante.
window.replayWhatsNew = function() {
  showWhatsNew([APP_CHANGELOG[0]]);
};

// Remplit les libellés de version depuis la constante, pour qu'ils ne
// divergent plus de la source de vérité.
function applyVersionLabels() {
  const court = $id('app-version-short');
  const long  = $id('app-version-long');
  if (court) court.textContent = 'Caca‑Tracker · v' + APP_VERSION;
  if (long)  long.textContent  = `Version ${APP_VERSION} — ${APP_VERSION_DATE}`;
}
