# Changelog — Caca-Tracker 3000 Deluxe

Toutes les modifications notables sont documentées ici.
Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

---

## [2.4.0] — 2026-02-19

### Ajouté
- **Année en review 🎬** : bouton dans l'onglet Stats → modal style Spotify Wrapped avec 7 cards (total, mois le plus actif, texture fav, heure de prédilection, meilleur streak, jour préféré, tonnage total)
- **Objectif du jour 🎯** : barre de progression dans le Dashboard avec sélecteur +/− (1–10 cacas), objectif sauvé en localStorage, indicateur vert quand atteint
- **Partage stats 📤** : bouton sous le gros bouton 💩 → génère une image PNG stylisée (canvas) avec stats clés, puis la partage via Web Share API ou téléchargement direct
- **Compte à rebours ⏱️** : timer live sous la prédiction, se rafraîchit chaque minute, affiche "Maintenant ? 🚨" si dépassé
- **Gestion des groupes ⚙️** : bouton dans l'onglet Social → panel membre par membre avec retrait individuel (créateur), quitter le groupe (membres), supprimer le groupe (créateur)
- `supabase-group-management.sql` : policy SQL pour autoriser le créateur à retirer des membres

### Corrigé
- Label "Chart.js ✅" supprimé du graphique 7 jours

---

## [2.3.0] — 2026-02-19

### Ajouté
- **Heatmap calendrier 📅** : grille des 365 derniers jours dans l'onglet Stats, colorée selon le nombre de cacas par jour (style GitHub contributions)
- **Notifications push 🔔** : rappel configurable si aucun caca depuis X heures (12/24/36/48h) — réglages dans l'onglet Historique ; le message utilise le pseudo de l'user connecté
- **Réactions sur le feed 💬** : réagir aux cacas des membres du groupe avec 💩🔥👑🤣❤️ — une réaction par user par caca, toggle, compteurs affichés en temps réel
- `supabase-reactions.sql` : migration SQL à exécuter dans Supabase pour activer les réactions

---

## [2.2.2] — 2026-02-19

### Corrigé
- **Reset mot de passe** : correction de l'erreur "Auth session missing!" lors du clic sur le lien de récupération par email
- Cause : `history.replaceState()` supprimait le token de l'URL avant que le SDK Supabase puisse l'utiliser
- Fix : utilisation de `onAuthStateChange` avec l'événement `PASSWORD_RECOVERY` au lieu de la détection manuelle du hash
- `initAuthListener()` ajouté dans `supabase-client.js` et appelé en premier dans `DOMContentLoaded`

---

## [2.2.1] — 2026-02-19

### Corrigé
- **Reset mot de passe** : lien de reset pointe désormais vers `caca-tracker.vercel.app` (plus vers localhost)
- **Reset mot de passe** : formulaire "Nouveau mot de passe" s'affiche automatiquement dans l'app quand on clique le lien depuis l'email (détection du token `type=recovery` dans l'URL)
- `updatePassword()` ajouté dans `supabase-client.js`

---

## [2.2.0] — 2026-02-19

### Ajouté
- **Sons par texture** : chaque texture (Normal, Dur, Mou, Spray, Liquide, Explosif) a son propre son configurable
- **Réglages sons** dans l'onglet Historique : sélecteur + bouton prévisualisation ▶️ par texture, préférences sauvées en localStorage
- **Import JSON** : bouton 📥 dans l'onglet Historique — fusion intelligente sans doublons
- **Mot de passe oublié** : lien dans la modal de connexion → email de réinitialisation via Supabase

### Corrigé
- **SW.js v3** : le Service Worker ne détourne plus les requêtes CDN cross-origin (Chart.js, Tailwind, Supabase…) — corrige le crash au lancement depuis l'écran d'accueil
- **RLS Supabase** : patch `supabase-rls-fix.sql` — fonctions `SECURITY DEFINER` pour briser la récursion infinie dans les policies `group_members` (corrige la création de groupes)
- **`index.html`** renommé en minuscules (était `Index.Html`) — compatibilité serveurs Linux / Vercel / GitHub Pages

---

## [2.1.0] — 2026-02-18

### Ajouté
- **Supabase** : authentification email/password, synchronisation cloud des données
- **Module social** (`js/social.js`) : groupes avec codes d'invitation, podium mensuel, comparatif 7 jours, feed d'activité, défi hebdomadaire automatique
- **3 nouveaux thèmes** : Kawaii 🌸 / Forêt 🌿 / Océan 🌊 (portant le total à 6)
- **Badge utilisateur** dans le header : avatar + pseudo, clic pour se connecter / voir le profil
- **Modal auth** : connexion + création de compte avec picker d'avatar
- **Modal profil** : stats, synchronisation manuelle, déconnexion
- **Wiring modules v2.0** : blagues, prédiction, graphiques avancés, achievements et animations désormais connectés à l'app
- `supabase-schema.sql` : schéma complet (5 tables, RLS, index, trigger auto-profil)
- `js/supabase-client.js` : client Supabase complet (auth + sync + groupes + stats sociales)
- `favicon.svg` : favicon emoji 💩 (supprime le 404)

### Corrigé
- **`sw.js`** : fichier caché `index.html` (casse correcte), bump version cache → invalide l'ancien cache
- **Volume slider** : le label de pourcentage se met à jour en temps réel pendant le glissement

---

## [2.0.1] — 2026-02-18

### Corrigé
- **`animations.js`** — Conflit de nom : `showConfetti()` écrasait la version inline du HTML. Renommé en `showRainbowConfetti()`.
- **`achievements.js`** — Achievement "Artiste 🌈" : couleurs comparées en anglais (`brown`, `red`…) alors que l'app stocke en français (`marron`, `rouge`…).
- **`achievements.js`** — Achievement "Régularité Parfaite ⭐" : `slice(-7)` analysait les 7 cacas les plus anciens → corrigé en `slice(0, 7)`.
- **`charts.js`** — Graphique couleurs : noms anglais → labels toujours incorrects. Corrigé en français + ajout de `arc-en-ciel`.
- **`charts.js`** — Graphique texture : utilisait `p.consistency` (inexistant) au lieu de `p.texture`.
- **`predictions.js`** — Calcul d'intervalles négatifs à cause d'un tri décroissant. Ajout d'un tri croissant dans le constructeur.
- **`Index.Html`** — Suppression de 3 balises `<meta>` PWA dupliquées.

---

## [2.0.0] — 2026-02-18

### Ajouté
- **Blagues de merde du jour** (`js/jokes.js`) : 30+ blagues rotatives, bouton "autre blague"
- **Moteur de prédiction** (`js/predictions.js`) : prochain caca estimé, heure moyenne, tendances
- **Graphiques avancés** (`js/charts.js`) : répartition horaire, par jour, couleurs, textures, tendance mensuelle
- **Achievements** (`js/achievements.js`) : 10 achievements déblocables
- **Sons** (`js/sounds.js`) : 6 sons avec contrôle du volume
- **Animations** (`js/animations.js`) : caca dansant, confettis arc-en-ciel, fireworks, streak
- **Styles modules** (`css/styles.css`)

---

## [1.1.0] — 2026-02-18

### Corrigé
- Poids par caca : 400 g → 150 g (valeur médicale correcte)
- Fix installation PWA sur iOS

### Ajouté
- Balises `<meta>` Apple PWA complètes
- Icônes PNG valides pour l'écran d'accueil iOS

---

## [1.0.0] — 2026-02-18

### Ajouté
- Tracker de cacas avec bouton 💩
- 6 textures, 6 couleurs, 3 thèmes
- Graphique des 7 derniers jours (Chart.js)
- Streak 🔥, 8 badges, historique, export JSON
- Mode "caca en retard" (saisie rétroactive)
- Comparaison stats France / Monde
- Confettis 🎉, PWA, localStorage
