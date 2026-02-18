// =================================================
// 🤣 JOKES MODULE - Blagues de merde du jour
// =================================================

const JOKES = [
  "Pourquoi les cacas ne parlent jamais? Parce qu'ils ont la langue dans le cul!",
  "Qu'est-ce qu'un caca qui se prend pour un super-héros? Un… cacapé!",
  "Comment appelle-t-on un caca qui fait du yoga? Un… cacazen!",
  "Quel est le caca préféré des pirates? Le cacahuète!",
  "Pourquoi le caca ne va jamais au cinéma? Parce qu'il préfère les films de merde!",
  "Comment appelle-t-on un caca intelligent? Un étron savant!",
  "Quel est le sport préféré du caca? Le cacabas!",
  "Pourquoi le caca ne joue jamais au poker? Il a toujours une mauvaise main!",
  "Qu'est-ce qu'un caca qui voyage? Un globe-trotteur!",
  "Comment un caca dit bonjour? Il fait coucou marron!",
  "Quel est le caca préféré des musiciens? Le cacaphonie!",
  "Pourquoi le caca est mauvais en math? Parce qu'il fait toujours des erreurs de calcul!",
  "Qu'est-ce qu'un caca qui danse? Un cacachotté!",
  "Comment appelle-t-on un caca qui raconte des histoires? Un conteur de merde!",
  "Pourquoi le caca évite les fêtes? Il a peur de finir dans la merde!",
  "Qu'est-ce qu'un caca romantique? Un caca-deau!",
  "Comment appelle-t-on un caca pressé? Un cacatastrophe!",
  "Quel est le jeu préféré du caca? Cache-cache brun!",
  "Pourquoi le caca ne fait jamais de régime? Il est déjà bien posé!",
  "Qu'est-ce qu'un caca qui fait de la musique? Un cacafon!",
  "Comment un caca devient célèbre? Il fait un carton!",
  "Quel est l'animal préféré du caca? Le cacatoes!",
  "Pourquoi le caca ne prend jamais de vacances? Il est toujours occupé!",
  "Qu'est-ce qu'un caca philosophe? Un penseur de merde!",
  "Comment appelle-t-on un caca qui fait du théâtre? Un cacabot!",
  "Pourquoi le caca est nul en géographie? Il se perd toujours!",
  "Qu'est-ce qu'un caca gourmand? Un cacahuète au chocolat!",
  "Comment un caca fait rire? Il raconte des blagues à chier!",
  "Quel est le pays préféré du caca? Le Cacabon!",
  "Pourquoi le caca ne joue pas aux échecs? Il est toujours mat!",
  "Qu'est-ce qu'un caca sportif? Un cacathlon!"
];

// Obtenir la blague du jour (basée sur la date)
function getDailyJoke() {
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return JOKES[dayOfYear % JOKES.length];
}

// Blague aléatoire
function getRandomJoke() {
  return JOKES[Math.floor(Math.random() * JOKES.length)];
}

// Afficher la blague du jour
function displayDailyJoke() {
  const jokeEl = document.getElementById('daily-joke');
  if (jokeEl) {
    jokeEl.textContent = getDailyJoke();
  }
}

// Changer pour une blague aléatoire
function showRandomJoke() {
  const jokeEl = document.getElementById('daily-joke');
  if (jokeEl) {
    jokeEl.textContent = getRandomJoke();
    // Animation
    jokeEl.style.opacity = '0';
    setTimeout(() => {
      jokeEl.style.transition = 'opacity 0.3s';
      jokeEl.style.opacity = '1';
    }, 50);
  }
}

// Export pour utilisation globale
window.JokesModule = {
  getDailyJoke,
  getRandomJoke,
  displayDailyJoke,
  showRandomJoke
};
