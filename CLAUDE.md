# 💩 Caca-Tracker 3000 Deluxe - v2.21.1

> ☁️ **Backend** : Supabase **auto-hébergé sur le NAS Unraid** depuis v2.9.0 (2026-07-14) — API `https://caca-api.yannick-uhrig.com` (Traefik + Cloudflare Tunnel → Postgres/GoTrue/PostgREST, stack `compose-stacks/caca-supabase`). L'ancien projet cloud `fnljhknjmmteawwomehb` est en pause.
>
> 🗄️ **Migrations** : elles s'appliquent depuis le clone du dépôt sur le NAS, `/mnt/user/appdata/compose-stacks/caca-supabase/caca-tracker` (`git pull` puis `./scripts/apply-migrations.sh`). ⚠️ Le dossier `repo-migrations/` qui traîne à côté est un **instantané figé** (migrations 13 → 16, script limité à la 16) : il s'exécute sans erreur en sautant les migrations plus récentes. Ne pas s'en servir.

## 🎯 Modifications prévues - Février 2026

### 📊 Statistiques avancées

#### Graphique horaire
- **Doughnut chart** des heures de prédilection (matin/midi/soir/nuit)
- Répartition sur 24h avec pourcentages
- Visualisation dans l'onglet Stats

#### Prédiction intelligente
- Algorithme basé sur l'historique des 7 derniers jours
- Calcul de l'intervalle moyen entre cacas
- Affichage : "Prochain caca estimé dans X heures"
- Icône 🔮 + message personnalisé

### 🏆 Gamification++ 

#### Achievements déblocables (extension)
1. **🌟 Régularité parfaite** : 7 jours d'affilée à ±2h de la même heure
2. **🏆 Record du mois** : Plus de cacas ce mois-ci que le précédent
3. **🎨 Artiste** : Toutes les couleurs utilisées au moins une fois
4. **⚡ Speed Runner** : 3 cacas en moins de 12h
5. **🌙 Hibou nocturne** : 5 cacas entre minuit et 6h
6. **☀️ Lève-tôt** : 10 cacas avant 8h du matin

#### Sons marrants
- 6 bruitages différents au choix:
  - Plop classique
  - Trompette
  - Applaudissements
  - Rires
  - "Achievement unlocked"
  - Pétards
- Réglage volume (0-100%)
- Toggle ON/OFF dans l'interface
- Play aléatoire ou séquentiel

#### Animations
- **Caca qui danse** : animation CSS rotate + bounce lors de l'ajout
- **Confettis arc-en-ciel** : 50 confettis colorés pour streaks > 5 jours
- **Shake effect** sur les achievements débloqués

### 🎭 Blague de merde du jour

**30+ blagues rotatives** :

Exemples:
- "Pourquoi les cacas ne parlent jamais? Parce qu'ils ont la langue dans le cul!"
- "Qu'est-ce qu'un caca qui se prend pour un super-héros? Un… cacapé!"
- "Comment appelle-t-on un caca qui fait du yoga? Un… cacazen!"
- "Quel est le caca préféré des pirates? Le cacahuète!"
- "Pourquoi le caca ne va jamais au cinéma? Parce qu'il préfère les films de merde!"
- ... + 25 autres

**Affichage** :
- Card dédiée en haut du Dashboard
- Rotation quotidienne (basée sur la date)
- Icône 🤣 + emoji aléatoire 💩
- Bouton "🔄 Blague aléatoire" pour changer

### 🎨 UX/UI Améliorations

#### Animations de transition
- **Fade + slide** entre les onglets (200ms)
- **Cubic-bezier** pour un effet fluide
- **Transform: translateX** pour le changement de tab
- Indicateur animé sous l'onglet actif

#### Micro-interactions
- Pulse sur le badge streak
- Glow effect sur les achievements débloqués
- Ripple effect sur les boutons
- Scale transform au hover

## 🛠️ Détails techniques

### Dépendances ajoutées
- **Aucune!** Tout en vanilla JS + CSS
- Sons : Data URIs (base64 inline)
- Animations : CSS3 @keyframes

### Nouveaux éléments HTML

```html
<!-- Blague du jour -->
<div class="card joke-of-day">
  <div class="flex items-center gap-2">
    <span class="text-3xl">🤣</span>
    <h4>Blague de merde du jour</h4>
  </div>
  <p id="daily-joke"></p>
  <button onclick="randomJoke()">🔄 Autre blague</button>
</div>

<!-- Prédiction -->
<div class="card prediction">
  <span>🔮</span>
  <span id="prediction-text">Prochain caca estimé dans...</span>
</div>

<!-- Graphique horaire -->
<canvas id="hour-chart"></canvas>

<!-- Contrôle son -->
<div class="sound-control">
  <button id="sound-toggle">🔊</button>
  <input type="range" id="volume" min="0" max="100" value="50">
</div>
```

### Nouvelles fonctions JS

```javascript
// Blagues
const JOKES = [...]  // 30+ blagues
function getDailyJoke()  // Basé sur date
function randomJoke()    // Aléatoire

// Prédiction
function calculateNextPoop()
function getAvgInterval()

// Sons
const SOUNDS = {...}     // 6 sons en base64
function playSound(type)
function setVolume(vol)

// Achievements
function checkRegularityAchievement()
function checkMonthRecordAchievement()
function checkArtistAchievement()
function checkSpeedRunnerAchievement()
function checkNightOwlAchievement()
function checkEarlyBirdAchievement()

// Animations
function dancePoop()
function rainbowConfetti()
function shakeAchievement(id)
```

### CSS ajouté

```css
/* Transitions fluides */
.tab-content {
  animation: fadeSlide 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes fadeSlide {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}

/* Caca qui danse */
@keyframes dance {
  0%, 100% { transform: rotate(0deg) scale(1); }
  25% { transform: rotate(-15deg) scale(1.1); }
  75% { transform: rotate(15deg) scale(1.1); }
}

/* Confetti arc-en-ciel */
.rainbow-confetti {
  animation: rainbowFall 2s ease-out forwards;
}

@keyframes rainbowFall {
  to { 
    transform: translateY(100vh) rotate(720deg); 
    opacity: 0; 
  }
}

/* Glow achievements */
.achievement-unlocked {
  animation: glow 1s ease-in-out infinite;
  box-shadow: 0 0 20px var(--accent);
}
```

## 📋 TODO List

- [x] Créer claude.md
- [ ] Ajouter les 30+ blagues dans un array
- [ ] Implémenter la fonction de prédiction
- [ ] Créer le graphique doughnut horaire
- [ ] Ajouter les 6 nouveaux achievements
- [ ] Intégrer les sons en base64
- [ ] Coder les animations CSS
- [ ] Ajouter le contrôleur de volume
- [ ] Tester sur iPhone de Clémence
- [ ] Commit & Push

## 🎉 Fonctionnalités existantes conservées

- ✅ localStorage persistence
- ✅ 3 thèmes (Chaud/Dark/Médical)
- ✅ Graphique 7 jours (Chart.js)
- ✅ Streak 🔥
- ✅ Badges existants
- ✅ Historique avec date rétroactive
- ✅ Stats vs France/Monde
- ✅ PWA iOS compatible
- ✅ Export JSON

## 🚀 Roadmap future (idées bonus)

### Phase 3 (Mars 2026?)
- Notifications push ("Pssst, ça fait 24h!")
- Widget iOS 18
- Siri Shortcuts
- Export PDF médical
- Partage sur réseaux sociaux (avec censure emoji)

## 👩‍💻 Auteur

**Papa de Clémence** - Développeur fun & fier 🚀

## 📝 Notes

- Application 100% fun pour Clémence (18 ans)
- Pas de backend, tout localStorage
- Design mobile-first
- PWA pour installation iPhone
- Code vanilla JS (pas de framework)
- Poids total : ~50KB

## 🆗 Changelog

### v2.21.1 (Septembre 2026) - 💖 TITRE AU PSEUDO

- 🔧 En-tête « Les cacas de <pseudo> » (`#app-title`, rempli par `updateUserBadge`), « Mes cacas » sans connexion
- 🔧 Bump cache SW caca-v42 → caca-v43

### v2.21.0 (Septembre 2026) - 👤 PROFIL RANGÉ + AVATARS ANIMÉS

- 🔄 **Modale profil en trois onglets** (`showProfileTab` dans `app-notifications.js`, classes `.pf-*` dans `styles.css`) ; connexion refaite sur le même gabarit, couleurs du thème au lieu de `bg-white`
- ➕ `js/app/app-avatars.js` : `AVATARS_FIXES` (50), `AVATARS_ANIMES` (12, un badge chacun), `avatarHTML()` / `setAvatarEl()` pour tout affichage d'avatar, `renderAvatarPicker()`
- ➕ Aucune migration : l'avatar reste un emoji dans `profiles.avatar` ; un emoji animé n'existe dans aucune autre liste (test `avatars.test.js`)
- 🔧 Bump cache SW caca-v41 → caca-v42

### v2.20.1 (Septembre 2026) - 🌽 PLUS DE MORTS FORCÉES

- 🔧 **Allure au pouce** dans Le Grand Transit : glissé vertical = frein (0,4×) ou accélérateur (1,8×), `transitSetAllure` / `s.allure`, retour auto à 1 quand le pouce est levé (`s.allureTenue`). Jauge à droite, flèches haut/bas au clavier
- 🔧 Méchantes bactéries : ne corrigent plus leur visée dans les 25 dernières unités (avant : poursuite jusqu'au contact, côlon quasi impossible)
- 🔧 Mâchoires espacées d'au moins 80 unités
- 📊 Joueur automatique sur 40 parcours par organe : bouche 38 → 1 mort, côlon 34 → 0
- 🔧 Bump cache SW caca-v40 → caca-v41

### v2.20.0 (Septembre 2026) - 🌽 LE GRAND TRANSIT

- ➕ **Le Grand Transit** (`js/jeux/transit.js`) : grain de maïs, 5 organes (bouche, œsophage, estomac, intestin grêle, côlon), carapace + bouclier, déplacement au glissé du pouce, horloge de transit (0 h → 36 h) et étoiles par organe. Mécanique propre à chacun : mâchoires, anneaux de péristaltisme et reflux, acide et enzymes, villosités aspirantes et jets de bile, bactéries et gaz
- ➕ **Sauvegarde par organe** dans `stats.transit.checkpoint` (`normalizeTransitCheckpoint` côté noyau) : une digestion renvoie au début de l'organe, pas du jeu
- ➕ **Test du maïs** (`js/app/app-mais.js`, clé `mais.tests.v1`) : vrai temps de transit, carte dans la tuile Transit des Stats + case dans la saisie. Refus d'un maïs revu en moins de 6 h, abandon automatique après 5 jours
- ➕ Écran des jeux : `inst.drag` (glissé continu) et `inst.noReady` (le jeu affiche son propre accueil)
- ➕ 3 badges (86 au total), tous dans `RARITY_SKIP` : données locales
- ➕ Migration `17_20260918_grand-transit.sql` — **appliquée en production le 2026-09-17** (dump préalable en `supabase_admin`, contrainte, RLS, trigger et API vérifiés) ; le repli reste en place : sans elle, le score du Grand Transit resterait en local (erreur 23514 détectée, plus de réessai)
- 🔧 Bump cache SW caca-v39 → caca-v40

### v2.19.0 (Septembre 2026) - 🎮 JEUX DU TRÔNE

- ➕ **Jeux du trône** (`js/jeux/`, écran `js/app/app-jeux.js`, styles `css/jeux.css`) : Plop!, Tour de PQ, Le Côlon, Course au trône, Qui a fait ce caca ?, Fosse septique tycoon. Ouverture : bouton accueil, 🎮 du chrono flottant, `?action=jeux` (+ raccourci du manifest)
- ➕ **Temps limité** : 8 min de séance (départ du chrono s'il tourne, sinon première partie), alerte à 1 min, pause des jeux 10 min (`jeux.pauseJusqua`). `stopTimer()` appelle `jeuxOnTimerStop()` ; finir avant la limite = « sortie digne »
- ➕ Stats locales `jeux.stats.v1` (records, meilleur score de la semaine, jardin) ; engrais de la fosse recalculé depuis `state.logs`
- ➕ **Classement hebdo** dans Social (`renderGameBoard`), table `game_scores` + trigger « le meilleur score gagne » — migration `16_20260917_jeux-du-trone.sql` — **appliquée en production le 2026-09-17** (dump préalable en `supabase_admin`, trigger « meilleur score » testé en transaction annulée, table illisible en anon via l'API) ; sans elle, carte masquée et scores gardés en local puis renvoyés
- ➕ Badges : catégorie `jeux` (8, total 83), dans `RARITY_SKIP` ; `computeBadges(logs, streak, games)`
- ➕ Stickers à débloquer (`unlock` dans `STICKERS`, `stickerUnlocked`)
- 🔧 Bump cache SW caca-v37 → caca-v39

### v2.18.0 (Septembre 2026) - 💩 MASCOTTE, SANTÉ, WRAPPED

> Reprend ce que font **Poopie** (widgets de série, classement par durée), **Poop Map** (ligues, stickers) et **Plop** / **Poop Tracker** (symptômes, déclencheurs).

- ➕ **Durée** en vraie donnée (`log.duration`, colonne `poops.duration_s`) : le chrono la reporte dans la saisie au lieu de l'écrire dans la note. Tuile Stats, badges ⏱️ 🏃 📖, classement « Reine de l'endurance »
- ➕ **Carnet de santé privé** (`log.health`, table `poop_health` lisible par sa seule propriétaire) : 20 étiquettes symptômes/contexte, tuile « Ce que j'ai remarqué » (`healthInsights`), alerte sang, section du PDF médical, colonnes CSV
- ➕ **Accueil allégé** (`js/app/app-accueil.js`) : carte « Aujourd'hui » avec **mascotte SVG** (humeurs, niveaux, lunettes à 7 j, couronne à 30 j), blocs secondaires repliés dans `#home-more`
- ➕ **Série en attente** : `streakDetails()` / `streakCore()` dans `app-render.js` — la série d'hier reste affichée jusqu'à minuit ; toast « joker utilisé » (`jokerToAnnounce`). `calculateStreak` inchangé
- ➕ **Saisie** (`js/app/app-saisie.js`) : plein écran sur téléphone, textures en SVG, « ⚡ Comme d'habitude » (`usualEntry`), vibrations (réglable), raccourcis `?action=add|timer|wrapped` + `shortcuts` du manifest + liens à copier pour Raccourcis iOS
- ➕ **Partage story 1080×1920** et **Caca Wrapped** en écrans successifs (`js/app/app-wrapped.js`) ; `shareStats()` et `openWrapped()` retirés d'`app-goal.js`. Rappel du Wrapped du 15 décembre au 15 janvier
- ➕ **Social** (`js/social-fun.js`) : stickers (`:sticker:id:`, aucun changement en base), série partagée du groupe, reine de l'endurance, **ligue entre groupes** sur inscription (`groups.league_opt_in`, fonction `group_league`)
- ➕ **Badges** : 75 (5 nouveaux), 11 catégories repliables, « à portée de main » (`nextBadges`), paliers de rareté (`rarityTier`)
- ➕ Thème qui **suit le téléphone** (clair/sombre) ; `UI.choose()` ; test de contraste WCAG des 16 thèmes
- ➕ Migration `15_20260917_duree-sante-ligue.sql` — **appliquée en production le 2026-09-17** (dump préalable en `supabase_admin`, RLS de `poop_health` vérifiée entre deux membres d'un même groupe) ; le client garde son repli (PGRST204/205/202) et repousse une fois durées et santé (`maybeBackfillExtrasCloud`)
- 🔧 Bump cache SW caca-v36 → caca-v37

### v2.17.0 (Septembre 2026) - 📊 REFONTE DES STATS

- 🔄 **Graphiques refaits** (`js/charts.js`) : heures par créneaux de 2 h en barres horizontales (`buildHourSlots`), jours lun→dim avec record en avant (`buildWeekdayBars`), courbe SVG 12 mois (`buildMonthlyTrend`), couleurs/textures sur le même gabarit (`buildShare`)
- 🎨 Système visuel commun : une seule teinte (thème) + encre neutre, marques fines, valeurs en texte, accent plein réservé à la donnée saillante
- ➕ **Réorganisation des blocs Stats** : `STATS_TILES` / `applyStatsOrder()` / `moveStatsTile()` dans `app-ui.js`, ordre dans `stats.tileOrder`, flèches ↑ ↓ (pas de glisser-déposer)
- ➕ **Bilan année ↔ mois** (`monthlyTotals()` dans `app-render.js`, choix dans `stats.bilanVue`)
- 🔧 **Fix Bristol** : « dur » comptait en types 1 ET 2, « normal » en 3 ET 4 — chaque selle comptée deux fois, aucun pourcentage juste. `bristolBreakdown()` rattache chaque texture à un seul type ; types 1 et 3 grisés (inatteignables avec 6 textures)
- 🔧 **Fix variation mensuelle** : le mois en cours était comparé au mois précédent complet (fausse chute chaque 1er). Comparaison à la même portion du mois précédent
- 🔄 **Année en review** : un grand chiffre + six tuiles, au lieu de sept cartes équivalentes
- 🔧 Bump cache SW caca-v35 → caca-v36

### v2.16.0 (Septembre 2026) - 📅 CALENDRIER LISIBLE

- 🔄 **Calendrier mensuel** (`buildMonthGrid` / `createMonthCalendar` / `renderCalendar` dans `js/charts.js`) à la place de la carte thermique annuelle : semaines lun→dim, numéros de jour, 💩 par case, navigation ‹ › bornée (mois courant ↔ premier caca), aujourd'hui cerclé, résumé du mois
- 🔧 Fix : l'écouteur de clic était ré-attaché à chaque `renderStats()` — quatre passages dans l'onglet Stats, quatre ouvertures de la modale. Délégation posée une seule fois
- 🗑️ `createHeatmap()` et les styles `.hm-*` supprimés
- 🔧 Bump cache SW caca-v34 → caca-v35

### v2.15.1 (Septembre 2026) - ☁️ RATTRAPAGE AUTO

- ➕ `maybeBackfillPoopMapCloud()` (`js/app/app-sync.js`) : au premier démarrage suivant la mise à jour, repousse une fois les entrées portant un lieu ou une position — le démarrage ne faisait qu'un pull, seul `afterLogin()` poussait, d'où la déco/reco manuelle
- ➕ Marqueur `poopmap.cloudBackfill.v1` ; non posé si la base n'a pas les colonnes (repli PGRST204), donc nouvelle tentative au lancement suivant
- ➕ `SupabaseClient.geoColumnsAvailable()`
- ➕ « Quoi de neuf » : où activer la position et la conquête dans les Réglages
- 🔧 Bump cache SW caca-v33 → caca-v34

### v2.15.0 (Septembre 2026) - 🏴 CONQUÊTE + HISTORIQUE FOUILLABLE

> Reprend ce que propose l'app **Poop Map** : conquête géographique, rareté des trophées, export CSV, historique cherchable.

- ➕ **Historique complet** : recherche plein texte (note, lieu, texture, date en toutes lettres), filtres texture/couleur/lieu/période, pagination par 20 — la liste s'arrêtait aux 20 dernières entrées
- ➕ **Territoires conquis** : commune / région / pays via Nominatim, drapeaux, réglage `poopmap.geocode` **distinct de la position et éteint par défaut** + bouton de rattrapage (1 req/s, lots de 25)
- ➕ **8 trophées de conquête** (📍 🧭 🏙️ 🚗 🛂 🥾 ✈️ 🏕️) — 70 badges au total
- ➕ **Rareté des badges** : « 2/5 l'ont », recalculée depuis les entrées du groupe (aucune donnée nouvelle en base) ; badges liés aux notes et aux positions exclus, ces données ne sont pas lues chez les copines
- ➕ **Export CSV** (séparateur `;` + BOM, pour Excel FR) et **bilan année par année**
- 🔧 `computeBadges(logs, streak)` extrait de `updateBadges()` (fonction pure) ; `calculateStreak(logs)` accepte une liste
- ➕ Migration `14_20260908_poopmap-conquete.sql` (`city`, `region`, `country`, `country_code`) — **appliquée en production le 2026-09-08** ; le repli côté client reste comme filet de sécurité
- ➕ `scripts/apply-migrations.sh` : applique les migrations 13 et 14 sur le NAS (transaction par fichier + `NOTIFY pgrst, 'reload schema'`, sans quoi PostgREST garde son ancien schéma en cache)
- 🔧 Bump cache SW caca-v32 → caca-v33

### v2.14.0 (Septembre 2026) - 🗺️ POOPMAP

- ➕ **Lieu d'un caca** : 8 étiquettes (🏠 💼 🏫 🍽️ 👯 🚆 🌳 🚻) à la saisie, visibles dans l'historique, classées dans les Stats
- ➕ **Position GPS optionnelle** (désactivée par défaut, `poopmap.geoEnabled`) : lue seulement sur clic du bouton 📍, arrondie à 4 décimales, effaçable en un bouton
- ➕ **Carte maison** (`js/poopmap.js`) : tuiles OpenStreetMap + maths slippy map, pan/zoom/recadrage, pastilles regroupées — **aucune dépendance ajoutée**
- ➕ 3 badges : 🧭 Exploratrice, 🌍 Globe-trotteuse, 🏠 Casanière (58 → 61)
- ➕ `UI.info()` : modale de lecture seule
- ➕ Migration `13_20260908_poopmap.sql` (`place`, `lat`, `lon`) — **appliquée en production le 2026-09-08** ; le client garde son repli sans ces colonnes en filet de sécurité
- 🔧 Fix sync cloud→local : `isRetro` était relu sous `p.is_retro` et se perdait
- 🔧 Bump cache SW caca-v31 → caca-v32

### v2.11.0 (Juillet 2026) - 💬 SOCIAL BOOST

- ➕ **Commentaires / chambrage** sous chaque caca du feed (fil déroulant + suppression, RLS `comments`)
- ➕ **Nudge / relance** : bouton « 👉 Relancer » sur les membres inactifs du jour → notif push (table `nudges` + worker)
- ➕ **Badges dans le feed** : déblocage d'achievement partagé au groupe (table `feed_events`, push aux copines)
- ➕ **Défis hebdo thématiques tournants** : count / lève-tôt / hibou / régularité / arc-en-ciel / série (rotation auto par n° de semaine, scoring par type)
- ➕ **Hall of Fame** : palmarès des gagnantes hebdo (table `challenge_wins`, calculé par le worker + backfill 8 semaines) + 🏆×N à côté des noms
- ➕ **Célébration gagnante** : overlay couronne + confettis quand tu remportes le défi de la semaine
- ➕ **Couronne 👑 reine du mois** dans le header si #1 du podium mensuel (≥2 membres actifs)
- ➕ **Récap hebdo « Wrapped »** : carte bilan de la semaine passée (total, championne, jour le + actif, réaction star), masquable
- ➕ **Réactions enrichies** : 8 emojis (ajout 😱 🤢 ⚡) + **mise à jour optimiste** (plus de re-render complet du feed)
- 🎨 **Toasts + modales** maison (`js/ui.js`) en remplacement de tous les `prompt/alert/confirm`
- 🔧 Worker push migré `Client` → `Pool` (jobs concurrents sans collision), nouveaux jobs nudges/badges/défis
- 🔧 Bump cache SW caca-v16 → caca-v17

### v2.10.0 (Juillet 2026) - ⚡ REALTIME + PUSH + SÉCURITÉ

- ➕ Feed social temps réel (Supabase Realtime self-hosted, conteneur `caca-realtime`)
- ➕ Notifications push Web Push : réactions + rappel 24h (worker `caca-push`, toggle Réglages)
- ➕ Streak tolérant (1 joker / 7 jours) + podiums des mois passés
- ➕ Templates mail FR : confirmation, invitation, changement d'email
- 🔒 Proxy admin `/admin/v1` (conteneur `caca-admin`) — la clé service_role ne quitte plus le serveur ; `app_secrets` supprimée
- 🔒 Backup quotidien caca-db (03h45 + offsite) + sondes Uptime Kuma
- 🗑️ Tables `hdd_*` supprimées
- 🔧 Bump cache SW caca-v15 → caca-v16

### v2.9.0 (Juillet 2026) - ☁️→🏠 MIGRATION NAS

- 🔧 Backend Supabase migré du cloud vers le NAS Unraid (Postgres + GoTrue + PostgREST auto-hébergés)
- 🔧 Nouvelle URL API `https://caca-api.yannick-uhrig.com` + nouvelle clé anon
- 🔧 Mails d'auth via Resend SMTP
- 🔧 Bump cache SW caca-v14 → caca-v15

### v2.8.0 (Février 2026) - 💀 SKELETONS + RECORDS + SANTÉ + PDF + DÉFI CUSTOM

- ➕ Skeleton loading animé sur podium, feed, comparatif, gestion membres (remplace les ⏳)
- ➕ Records personnels dans Stats : meilleur streak, meilleur jour, meilleure semaine, meilleur mois
- ➕ Tendances de santé sur le Dashboard : alertes constipation (>48h), selles liquides consécutives, dures consécutives, + message positif si streak ≥ 7j
- ➕ Pull-to-refresh sur l'onglet Social (mobile) : tirer vers le bas pour actualiser
- ➕ Export PDF médical : bouton "🏥 PDF médical" dans Stats → rapport imprimable avec Bristol, fréquence, transit
- ➕ Défi personnalisé : le créateur du groupe peut modifier le titre du défi hebdomadaire (bouton ✏️)
- 🔧 Bump cache SW caca-v8 → caca-v9

### v2.7.0 (Février 2026) - 🔬 BRISTOL + ANNIVERSAIRES + OFFLINE SYNC

- ➕ Échelle de Bristol interactive dans l'onglet Stats (7 niveaux avec répartition réelle de l'utilisatrice)
- ➕ Anniversaires de cacas sur le Dashboard (ex: "Il y a 1 an, c'était ton 100ème caca !")
- ➕ Comparatif mensuel à 3 colonnes : mois précédent / ce mois / même mois l'an dernier
- ➕ Résolution de conflits multi-appareils : champ `updated_at` + merge intelligent (version la plus récente gagne)
- ➕ Queue offline : les cacas ajoutés/supprimés sans connexion sont mis en attente et synchronisés automatiquement au retour du réseau
- 🔧 Bump cache SW caca-v7 → caca-v8

### v2.6.0 (Février 2026) - ☁️ SYNC FIX + CONTRASTE + UX
- 🔧 Fix sync cloud→local : les données Supabase sont maintenant chargées sur tout nouveau appareil/navigateur lors de la connexion ou de la restauration de session
- 🔧 Fix contraste thèmes : ajout d'overrides CSS complets pour Galaxy et Neon (classes Tailwind invisibles sur fond sombre corrigées) + texte secondaire plus foncé sur Forêt, Océan, Sakura, Mint, Tropicale
- ➕ Onglets de filtre du feed social (Aujourd'hui / Semaine / Mois / Année) + filtre par membre
- ➕ Icône Superman 🦸 dans le header pour les admins
- ➕ Bouton 📤 Exporter mes stats visible dans l'onglet Stats
- ➕ Bouton 📷 QR visible (remplace l'icône FontAwesome)
- ➕ Suppression de membres dans l'admin (avec clé service role)
- ➕ Permissions d'invitation groupe (toggle créateur uniquement)
- 🔧 Fix graphiques CSS : couleurs thème-adaptées, couleurs valides pour la répartition des consistances/couleurs, layout légendes corrigé

### v2.5.0 (Février 2026) - 👥 SOCIAL + QR + 58 BADGES + THÈMES
- ➕ Connexion / inscription Supabase
- ➕ Groupes d'amies + code QR + auto-join ?join=CODE
- ➕ Podium, comparatif, feed, défi hebdomadaire, réactions emoji
- ➕ 58 badges (vs 8 auparavant)
- ➕ 30 avatars emoji sélectionnables
- ➕ 16 thèmes avec sélecteur dans le profil
- ➕ Page admin (gestion utilisateurs, toggle admin, reset MDP)

### v2.0 (Février 2026) - 🎉 MEGA UPDATE
- ➕ Blague de merde du jour
- ➕ Graphique horaire (doughnut)
- ➕ Prédiction intelligente
- ➕ 6 nouveaux achievements
- ➕ Sons marrants (6 types)
- ➕ Contrôle volume
- ➕ Animations fluides
- ➕ Confettis arc-en-ciel
- ➕ Caca qui danse

### v1.1 (Février 2026)
- 🔧 Fix poids caca : 400g → 150g
- 🔧 Fix iOS PWA installation
- ➕ Balises meta iOS
- ➕ Icônes PNG valides

### v1.0 (Février 2026) - 🎆 INITIAL RELEASE
- ✨ Tracker de cacas
- 📊 Stats & graphiques
- 🏆 Badges
- 📅 Historique
- 🎨 3 thèmes
- 🔥 Streak
- 📱 PWA
- 💾 localStorage

---

**Fait avec ❤️ et beaucoup de 💩**
