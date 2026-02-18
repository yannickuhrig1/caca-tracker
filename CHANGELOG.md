# Changelog — Caca-Tracker 3000 Deluxe

Toutes les modifications notables sont documentées ici.
Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

---

## [2.0.1] — 2026-02-18

### Corrigé
- **`animations.js`** — Conflit de nom : `showConfetti()` dans `animations.js` écrasait la version inline du HTML. Renommé en `showRainbowConfetti()` pour préserver les deux comportements.
- **`achievements.js`** — Achievement "Artiste 🌈" ne se débloquait jamais : les couleurs étaient comparées en anglais (`brown`, `red`, `green`…) alors que l'app stocke en français (`marron`, `rouge`, `vert`…).
- **`achievements.js`** — Achievement "Régularité Parfaite ⭐" analysait les 7 cacas les plus **anciens** au lieu des 7 plus **récents** (`slice(-7)` → `slice(0, 7)`).
- **`charts.js`** — Graphique couleurs : mêmes noms anglais → emojis et labels toujours incorrects. Corrigé en français + ajout de `arc-en-ciel`.
- **`charts.js`** — Graphique texture/consistance : utilisait `p.consistency` (champ inexistant) au lieu de `p.texture` → graphique toujours vide. Les labels ont également été mis à jour avec les vraies valeurs (`normal`, `dur`, `mou`, `spray`, `liquide`, `explosif`).
- **`predictions.js`** — `state.logs` est trié du plus récent au plus ancien. Le moteur de prédiction calculait des intervalles négatifs et prenait le plus vieux caca comme "dernier caca". Ajout d'un tri croissant dans le constructeur de `PredictionEngine`.
- **`Index.Html`** — Suppression de 3 balises `<meta>` PWA dupliquées (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`).

---

## [2.0.0] — 2026-02-18

### Ajouté
- **Blagues de merde du jour** (`js/jokes.js`) : 30+ blagues rotatives basées sur la date, bouton "autre blague"
- **Moteur de prédiction** (`js/predictions.js`) : prochain caca estimé, heure moyenne, période préférée, tendances hebdomadaires
- **Graphiques avancés** (`js/charts.js`) : répartition horaire (24h), par jour de semaine, couleurs, textures, tendance mensuelle
- **Achievements** (`js/achievements.js`) : 10 achievements — Premier Caca, Décade, Centenaire, Régularité, Lève-Tôt, Hibou, Artiste, Streak 7j, Streak 30j, Record du Mois
- **Sons** (`js/sounds.js`) : 6 sons (plop, splash, wow, tada, achievement, confetti) avec contrôle du volume
- **Animations** (`js/animations.js`) : caca dansant, confettis arc-en-ciel, animation streak, fireworks pour les milestones
- **Styles modules** (`css/styles.css`) : CSS dédié pour tous les nouveaux composants

---

## [1.1.0] — 2026-02-18

### Corrigé
- Poids par caca : 400 g → 150 g (valeur médicale correcte)
- Fix installation PWA sur iOS (balises meta manquantes)

### Ajouté
- Balises `<meta>` Apple PWA complètes
- Icônes PNG valides pour l'écran d'accueil iOS

---

## [1.0.0] — 2026-02-18

### Ajouté
- Tracker de cacas avec bouton 💩
- **6 textures** : Normal, Dur, Mou, Spray, Liquide, Explosif
- **6 couleurs** : Marron, Jaune, Vert, Noir, Arc-en-ciel, Rouge
- **3 thèmes** : Chaud / Dark / Médical
- Graphique des 7 derniers jours (Chart.js)
- Streak 🔥 dans le header
- 8 badges déblocables
- Historique avec suppression individuelle et export JSON
- Mode "caca en retard" (saisie rétroactive)
- Comparaison stats France / Monde
- Confettis 🎉 à l'ajout d'un caca
- PWA : Service Worker + manifest + installation iPhone
- Persistance via `localStorage`
