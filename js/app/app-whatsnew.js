// ============================================================
//  app-whatsnew.js
//  Version de l'app + popup « Quoi de neuf » au premier lancement
//  suivant une mise a jour.
//  Charge apres app-core.js (utilise $id).
// ============================================================

// Source de vérité unique de la version. L'en-tête et les Réglages sont
// remplis à partir d'ici, ce qui évite qu'ils divergent comme par le passé.
const APP_VERSION = '2.13.0';
const APP_VERSION_DATE = 'Août 2026';

// De la plus récente à la plus ancienne. `items` reste court et écrit pour
// Clémence, pas pour un développeur : ce que ça change pour elle, pas comment.
const APP_CHANGELOG = [
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
