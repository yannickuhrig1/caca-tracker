// ============================================================
//  app-onboarding.js
//  Presentation en 3 ecrans a la premiere ouverture.
//  Charge apres les autres modules app-* : il utilise $id et switchTab.
// ============================================================

const ONBOARDING_KEY = 'cacaTracker.onboardingSeen';

const ONBOARDING_SLIDES = [
  {
    emoji: '💩',
    titre: 'Bienvenue !',
    texte: 'Ici tu notes tes cacas. L\'app en tire des statistiques, des badges et des comparaisons — le tout gardé sur ton téléphone.'
  },
  {
    emoji: '👇',
    titre: 'Un gros bouton, c\'est tout',
    texte: 'Appuie sur le bouton 💩 de l\'accueil, choisis une texture et une couleur, valide. Tu peux aussi saisir un caca oublié en activant « caca en retard ».'
  },
  {
    emoji: '👯',
    titre: 'Avec tes copines',
    texte: 'Crée un compte pour retrouver tes données sur tous tes appareils, puis rejoins un groupe avec un code ou un QR : podium, défis de la semaine et chambrage inclus.'
  }
];

let _slideIndex = 0;

// Affiche la présentation seulement à la toute première ouverture.
// Une utilisatrice qui a déjà des entrées n'a rien à découvrir : on marque
// simplement comme vu, pour ne pas l'interrompre après une mise à jour.
function maybeShowOnboarding() {
  if (!$id('onboarding')) return;
  if (localStorage.getItem(ONBOARDING_KEY) === '1') return;
  if (state.logs.length > 0) { localStorage.setItem(ONBOARDING_KEY, '1'); return; }
  // Une invitation en cours a la priorité : on ne s'interpose pas.
  if (new URLSearchParams(window.location.search).get('join')) return;
  showOnboarding();
}

function showOnboarding() {
  _slideIndex = 0;
  renderOnboardingSlide();
  $id('onboarding').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onboardingKeydown);
  $id('onboarding-next')?.focus();
}

function closeOnboarding() {
  $id('onboarding').classList.add('hidden');
  document.body.style.overflow = '';
  document.removeEventListener('keydown', onboardingKeydown);
  localStorage.setItem(ONBOARDING_KEY, '1');
}

function onboardingKeydown(e) {
  if (e.key === 'Escape')     closeOnboarding();
  if (e.key === 'ArrowRight') nextOnboardingSlide();
  if (e.key === 'ArrowLeft' && _slideIndex > 0) { _slideIndex--; renderOnboardingSlide(); }
}

function nextOnboardingSlide() {
  if (_slideIndex < ONBOARDING_SLIDES.length - 1) {
    _slideIndex++;
    renderOnboardingSlide();
  } else {
    closeOnboarding();
  }
}

function renderOnboardingSlide() {
  const s = ONBOARDING_SLIDES[_slideIndex];
  const dernier = _slideIndex === ONBOARDING_SLIDES.length - 1;

  $id('onboarding-emoji').textContent = s.emoji;
  $id('onboarding-title').textContent = s.titre;
  $id('onboarding-text').textContent  = s.texte;
  $id('onboarding-next').textContent  = dernier ? 'C\'est parti !' : 'Suivant';
  $id('onboarding-skip').classList.toggle('invisible', dernier);

  $id('onboarding-dots').innerHTML = ONBOARDING_SLIDES
    .map((_, i) => `<span class="onb-dot${i === _slideIndex ? ' active' : ''}"></span>`)
    .join('');

  const live = $id('onboarding-card');
  if (live) live.setAttribute('aria-label', `Étape ${_slideIndex + 1} sur ${ONBOARDING_SLIDES.length} : ${s.titre}`);
}

// Rejouable depuis les Réglages
window.replayOnboarding = function() {
  switchTab('dashboard');
  showOnboarding();
};
