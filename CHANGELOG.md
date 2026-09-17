# Changelog — Caca-Tracker 3000 Deluxe

Toutes les modifications notables sont documentées ici.
Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

---

## [2.20.0] — 2026-09-18

### Ajouté
- **🌽 Le Grand Transit** (`js/jeux/transit.js`) — on incarne un grain de maïs
  avalé, à faire ressortir entier :
  - Cinq organes : la bouche (molaires, et le carrefour œsophage / trachée),
    l'œsophage (anneaux de péristaltisme qui propulsent ouverts et serrent
    fermés, remontées acides qui font reculer), l'estomac (flaques d'acide,
    enzymes, bulles qui réparent), l'intestin grêle (villosités qui aspirent
    vers les parois, jets de bile, vitamines) et le côlon (bactéries,
    bouchons, gaz qui propulsent, eau réabsorbée qui ralentit).
  - Portes de sortie propres à chaque organe : épiglotte, cardia, pylore,
    valvule iléo-cæcale, sphincter.
  - **Carapace** en guise de vie, **bouclier** au toucher (recharge 3,5 s),
    déplacement au **glissé du pouce**.
  - **Sauvegarde à l'entrée de chaque organe** : la traversée peut s'étaler
    sur plusieurs séances, et une digestion ne renvoie pas à la bouche.
  - Horloge du transit (0 h → 36 h), étoiles par organe, anecdotes digestives.
- **⏳ Test du maïs** (`js/app/app-mais.js`) — le vrai examen de transit :
  « J'ai mangé du maïs » dans les Stats, puis « Je vois du maïs » à la saisie.
  L'app calcule le temps réel, le commente (rapide / normal / lent), garde
  l'historique et la moyenne. Un maïs revu en moins de 6 h est refusé (il
  vient d'un repas précédent) et un test oublié s'arrête au bout de 5 jours.
- **Badges** : Le Grand Transit, Ressortie Intacte, Test du Maïs (86 au total).

### Technique
- Glissement continu du doigt ajouté à l'écran des jeux (`inst.drag`), et
  écran d'accueil propre au jeu (`inst.noReady`).
- Migration `17_20260918_grand-transit.sql` (**pas encore appliquée**) :
  ajoute `transit` aux jeux autorisés dans `game_scores`. Sans elle, la base
  refuse le score (23514), le client le garde en local et cesse de réessayer.
- Tests : `jeux-transit`, `mais`.
- Cache SW caca-v39 → caca-v40.

---

## [2.19.0] — 2026-09-17

### Ajouté
- **🎮 Jeux du trône** — un écran de jeux pour la séance, ouvert depuis
  l'accueil, le chrono flottant ou le raccourci `?action=jeux` :
  - **🚽 Plop!** : lâcher le caca dans la cuvette qui glisse, série de plops
    parfaits, 3 éclaboussures et c'est fini.
  - **🧻 Tour de PQ** : empiler des rouleaux, ce qui dépasse est coupé.
  - **🐍 Le Côlon** : Snake au doigt ; fibres, fast-food qui bouche, piment
    qui accélère.
  - **🏃‍♀️ Course au trône** : runner à un doigt avec jauge d'urgence.
  - **🕵️ Qui a fait ce caca ?** : quiz sur les entrées des copines (jour,
    heure, texture, couleur, lieu, durée ; jamais notes, positions ni santé).
  - **🌻 Fosse septique tycoon** : jardin qui pousse avec l'engrais gagné
    par l'historique ; récolte quotidienne.
- **⏳ Temps limité** — 8 minutes de séance (depuis le chrono s'il tourne),
  alerte la dernière minute, puis 10 minutes de pause des jeux. Terminer
  avant la limite compte une « sortie digne » (+20 d'engrais).
- **🏆 Classement hebdo** des jeux dans l'onglet Social (table
  `game_scores`, migration 16, carte masquée sans elle).
- **Badges** : catégorie « Jeux du trône », 8 badges (83 au total), exclus
  de la rareté (statistiques locales).
- **Stickers** débloqués par les badges de jeu (visibles par tout le monde,
  posables seulement une fois le badge gagné).
- La mascotte réagit en fin de partie ; score partageable en story 1080×1920.

### Technique
- `js/jeux/` : `jeux-core.js` (session, stats, badges, classement) et un
  fichier par jeu, logique pure séparée du dessin. `js/app/app-jeux.js` :
  écran, boucle, entrées, branchement sur `stopTimer()`.
- `css/jeux.css`, migration `16_20260917_jeux-du-trone.sql` (**appliquée en
  production le 2026-09-17**, après sauvegarde ; RLS, trigger et accès anon
  vérifiés), `scripts/apply-migrations.sh` l'inclut.
- Tests : `jeux-core`, `jeux-arcade`, `jeux-quiz-fosse`.
- Cache SW caca-v37 → caca-v39.

---

## [2.18.0] — 2026-09-17

### Ajouté
- **💩 Mascotte et carte « Aujourd'hui »** — l'accueil tient sur un écran :
  humeur du jour (contente, en fête, inquiète, endormie…), niveau selon le
  nombre total de cacas, accessoires gagnés avec la série. Blague, prédiction,
  défi 7 jours et résumé de la semaine sont repliés sous un seul bouton.
- **⏱️ Durée des séances** — le chrono remplit un champ dédié (avant : du texte
  dans la note). Tuile Stats (moyenne, médiane, record, temps total), badges
  Chronométreuse / Express / Marathon, classement « Reine de l'endurance ».
- **🩺 Carnet de santé privé** — 7 symptômes et 13 éléments de contexte à la
  saisie ; tuile « Ce que j'ai remarqué » qui compare les selles avec et sans
  chaque étiquette ; alerte si du sang est noté ; section dans le PDF médical.
  Stocké dans une table à part lisible par sa seule propriétaire.
- **⚡ Saisie plus rapide** — « Comme d'habitude », textures dessinées, saisie
  plein écran sur téléphone, vibrations, raccourcis d'app (Android) et liens
  pour l'app Raccourcis (iPhone).
- **📤 Partage en image story** (semaine, mois, année) et **🎬 Caca Wrapped**
  en écrans successifs, partageable.
- **👥 Social** — stickers dans les commentaires, série partagée du groupe
  (avec qui manque à l'appel), ligue entre groupes sur inscription.
- **🏆 Badges** — 5 nouveaux (75), catégories repliables, « à portée de main »,
  paliers de rareté.
- **🌓 Thème du téléphone** — option pour passer en sombre avec le téléphone.

### Modifié
- La série n'affiche plus 0 tant qu'aucun caca n'est noté aujourd'hui : celle
  d'hier reste visible, pâlie, jusqu'à minuit. Un message annonce quand le
  joker a sauvé la série.
- Export CSV : colonnes `duree_s` et `sante`.

### Base de données
- Migration `15_20260917_duree-sante-ligue.sql` (`poops.duration_s`, table
  `poop_health` + RLS propriétaire, `groups.league_opt_in`, fonction
  `group_league`). **Appliquée en production le 2026-09-17**, après sauvegarde.
  Déploiement indifférent : sans elle, durée et santé restent locales et la
  ligue est masquée.

### Tests
- 237 tests (+77) : santé et durée, série en attente, mascotte, Wrapped,
  fonctions sociales, catégories et rareté des badges, lignes cloud, contraste
  WCAG des 16 thèmes.

---

## [2.17.0] — 2026-09-08

### Ajouté
- **🔀 Ordre des blocs de l'onglet Stats** — bouton « Réorganiser », puis des
  flèches ↑ ↓ sur chaque bloc ; l'ordre est mémorisé (`stats.tileOrder`) et
  rejoué à chaque ouverture. Des boutons plutôt qu'un glisser-déposer : au doigt,
  sur une page qui défile, le glisser rate une fois sur deux. Un bloc ajouté par
  une version ultérieure vient se placer à la fin sans casser l'ordre existant.
- **📅 Bilan année ↔ mois** — le bloc annuel bascule sur les 12 derniers mois,
  le choix est mémorisé. Le mois en cours est ramené aux jours écoulés, comme
  l'année en cours.

### Modifié
- **🕒 Heures de prédilection** — 24 barres de 14 px sans étiquette lisible sont
  devenues 12 lignes horizontales par créneaux de 2 h, chacune étiquetée, avec le
  pic en avant et sa part du total.
- **📆 Fréquence par jour** — semaine du lundi au dimanche (elle commençait un
  dimanche), valeur au-dessus de chaque colonne, jour record en accent plein.
- **📈 Tendance mensuelle** — des barres détachées remplacées par une courbe +
  aire sur 12 mois, avec un point par mois et son infobulle.
- **🎨 Couleurs et textures** — même gabarit de barres horizontales, tri par
  fréquence, pourcentages alignés.
- **🎬 Année en review** — un grand chiffre porte le récap, six tuiles
  l'accompagnent ; c'étaient sept cartes de même poids visuel.
- Système visuel commun aux graphiques : une seule teinte (celle du thème) plus
  de l'encre neutre, marques fines, extrémités arrondies, valeurs en texte et non
  en couleur ; seule la donnée saillante passe en accent plein.

### Corrigé
- **🔬 Échelle de Bristol : chaque selle était comptée deux fois.** « dur »
  alimentait les types 1 et 2, « normal » les types 3 et 4 ; le total de
  référence était donc gonflé et **aucun pourcentage n'était juste**. Chaque
  texture est désormais rattachée à un seul type, les pourcentages somment à
  100 %, et les deux types qu'aucune texture de l'app ne peut produire (1 et 3)
  sont grisés et annoncés comme tels.
- **📈 Variation mensuelle trompeuse** — le mois en cours était comparé au mois
  précédent *complet*, ce qui affichait une chute spectaculaire chaque début de
  mois (−78 % sur un jeu de test au 8 du mois). La comparaison se fait
  maintenant à la même portion du mois précédent (−20 % sur le même jeu), et le
  libellé le dit : « vs le mois dernier à la même date ».

### Supprimé
- Les styles `.chart-container`, `.bar-chart`, `.pie-chart-legend` et le titre de
  section « Statistiques Avancées », remplacés par le nouveau gabarit.

### Modifié (technique)
- 🔧 Bump cache SW caca-v35 → caca-v36

## [2.16.0] — 2026-09-08

### Modifié
- **📅 Calendrier mensuel** en remplacement de la carte thermique annuelle des
  Stats. La grille façon « contributions GitHub » était jolie de loin, mais on
  n'y lisait ni les dates ni les quantités : 365 carrés de 12 px sans un seul
  chiffre.
  - Un vrai calendrier : semaines du lundi au dimanche, numéro du jour, et les
    💩 de la journée dans la case (au-delà de 3, un `💩 ×N`)
  - Navigation ‹ › mois par mois, bornée au mois courant d'un côté et au tout
    premier caca de l'autre — plus de mois vides à faire défiler
  - Aujourd'hui est cerclé, les jours à venir sont estompés
  - Résumé du mois : total, jours actifs, jour record
  - Clic (ou Entrée au clavier) sur un jour rempli : le détail de la journée,
    comme avant
  - `buildMonthGrid()` est une fonction pure, testée — dont le cas du caca de
    23 h, qui restait sur son jour uniquement parce que les clés sont calculées
    en heure locale

### Corrigé
- L'écouteur de clic du calendrier était ré-attaché **à chaque affichage** de
  l'onglet Stats : après quatre passages, un clic sur un jour ouvrait quatre
  fois la modale. La délégation n'est désormais posée qu'une fois.

### Supprimé
- `createHeatmap()` et les styles `.hm-*`, devenus sans usage.

### Modifié (technique)
- 🔧 Bump cache SW caca-v34 → caca-v35

## [2.15.1] — 2026-09-08

### Ajouté
- **Rattrapage automatique du cloud** — les colonnes `place` / `lat` / `lon` /
  `city` … sont arrivées après coup (migrations `13` et `14`) : les cacas
  enregistrés avant existaient dans le cloud sans elles. Au démarrage, l'app ne
  faisait qu'un pull (cloud → local) ; seul `afterLogin()` poussait dans l'autre
  sens, ce qui obligeait à se **déconnecter puis reconnecter à la main** pour que
  la carte suive d'un appareil à l'autre.
  `maybeBackfillPoopMapCloud()` repousse désormais une fois, au premier démarrage
  suivant la mise à jour, les seules entrées qui portent un lieu ou une position.
  - Marqueur `poopmap.cloudBackfill.v1` : l'opération ne se répète pas
  - Si la base n'a pas encore les colonnes (repli PGRST204), le marqueur **n'est
    pas** posé et la tentative est refaite au lancement suivant
  - `poopMapEntriesToPush()` est une fonction pure, testée
- Le « Quoi de neuf » explique où activer la position et la conquête dans les
  Réglages — sans ça, la carte reste vide et rien ne le dit.

### Modifié
- `SupabaseClient.geoColumnsAvailable()` expose si la base connaît les colonnes
  PoopMap, ce qui permet au rattrapage de savoir s'il a réellement servi.
- 🔧 Bump cache SW caca-v33 → caca-v34

## [2.15.0] — 2026-09-08

Inspiré de ce que propose l'app **Poop Map** : conquête géographique, rareté
des trophées, export CSV, historique fouillable.

### Ajouté
- **🔎 Historique complet et fouillable** — l'écran s'arrêtait aux 20 dernières
  entrées, sans aucun moyen de remonter plus loin.
  - Recherche plein texte : note, lieu, texture, couleur, humeur et **date en
    toutes lettres** (« lundi », « janvier », « 2026 »)
  - Filtres texture / couleur / lieu / période (7 j, 30 j, cette année)
  - Pagination par tranches de 20 (« ⬇️ Voir plus »), compteur de résultats et
    bouton de réinitialisation
  - `filterLogs()` est une fonction pure, testée
- **🏴 Territoires conquis** — commune, région et pays de chaque caca
  géolocalisé, avec les drapeaux, affichés sous la carte.
  - **Second réglage, distinct de la position et éteint par défaut** : nommer
    un lieu suppose d'envoyer les coordonnées à Nominatim (l'annuaire
    d'OpenStreetMap), ça se décide séparément
  - Résolution en tâche de fond après la saisie — jamais bloquante, et l'entrée
    est enregistrée même si le réseau tombe
  - Bouton « 🌍 Nommer les positions déjà enregistrées » pour rattraper
    l'historique, une requête par seconde comme l'exige Nominatim, par lots de 25
  - Modifier la position d'une entrée efface la commune qui n'y correspond plus
- **8 trophées de conquête** : 📍 Première Conquête, 🧭 Cartographe (10 spots),
  🏙️ Touriste (3 communes), 🚗 Roadtrip (3 régions), 🛂 Passeport Tamponné
  (2 pays), 🥾 Aventurière (+50 km du QG), ✈️ Long-Courrier (+500 km),
  🏕️ Pleine Nature — **70 badges au total**.
- **💎 Rareté des badges** — « 2/5 l'ont » sous chaque badge, avec 💎 en dessous
  d'un tiers du groupe. Calculée en rejouant les conditions sur les entrées des
  membres : rien de nouveau à stocker. Les badges qui dépendent des **notes** ou
  des **positions** en sont exclus — on ne lit pas ces données-là chez les
  copines, et un faux « 0/5 » vaudrait moins que rien.
- **📊 Export CSV** — toutes les entrées en tableau (date, heure, texture,
  couleur, humeur, lieu, position, retard, note). Séparateur `;` et BOM UTF-8
  pour qu'Excel FR l'ouvre correctement du premier coup.
- **📅 Année par année** — total, moyenne par jour, jours actifs et meilleur
  mois. L'année en cours est ramenée aux jours écoulés, pas à 365.
- Migration `14_20260908_poopmap-conquete.sql` : `city`, `region`, `country`,
  `country_code` sur `poops`. **Appliquée en production le 2026-09-08** avec la
  `13` ; le repli PGRST204 / 42703 reste en place comme filet de sécurité.
- `scripts/apply-migrations.sh` — applique les migrations `13` et `14` sur la
  base du NAS, une transaction par fichier, puis vérifie les colonnes et
  recharge le cache de schéma PostgREST.
- Les deux migrations se terminent par `NOTIFY pgrst, 'reload schema';` : sans
  ce signal, PostgREST garde son ancienne image du schéma et continue de
  répondre « colonne inconnue » alors que les colonnes existent — l'app
  semblerait alors ne rien synchroniser malgré une migration réussie.
  Vérifiées pour de bon sur un PostgreSQL 16 : application, garde-fous
  (latitude 91 et code pays « france » refusés, bornes ±90/±180 acceptées),
  idempotence du rejeu, et données existantes intactes.

### Modifié
- `updateBadges()` est scindé : `computeBadges(logs, streak)` est désormais une
  fonction pure (c'est elle qui permet de calculer la rareté), et `updateBadges()`
  ne fait plus que peindre le résultat.
- `calculateStreak(logs)` accepte une liste d'entrées, pour calculer le streak
  d'une copine sans toucher à l'état global.
- 🔧 Bump cache SW caca-v32 → caca-v33

## [2.14.0] — 2026-09-08

### Ajouté
- **🗺️ PoopMap** — deux niveaux indépendants, le second entièrement facultatif :
  - **Lieu** : 8 étiquettes (🏠 Maison, 💼 Boulot, 🏫 École, 🍽️ Resto, 👯 Chez une
    copine, 🚆 Transport, 🌳 Nature, 🚻 Ailleurs) proposées à la saisie, affichées
    dans l'historique et classées dans un nouveau bloc de l'onglet Stats. Aucune
    autorisation à demander, fonctionne hors ligne.
  - **Position GPS** : **désactivée par défaut**, à activer dans ⚙️ Réglages. Elle
    n'est lue que sur clic explicite du bouton 📍 dans la fiche de saisie, arrondie
    à 4 décimales (~11 m) et jamais partagée avec le groupe. Bouton
    « 🧹 Effacer toutes mes positions » qui conserve les lieux.
  - **Carte** dessinée à la main : tuiles OpenStreetMap en `<img>` + calcul slippy
    map, déplacement au doigt/souris, zoom, recadrage, pastilles regroupées par
    endroit. **Aucune bibliothèque ajoutée** (pas de Leaflet). Hors ligne les tuiles
    ne chargent pas, les pastilles restent positionnées entre elles.
  - Stats associées : nombre de spots, cacas géolocalisés, distance du plus lointain
    au « QG » (l'endroit le plus fréquenté).
- **3 badges** : 🧭 Exploratrice (3 lieux), 🌍 Globe-trotteuse (les 8 lieux),
  🏠 Casanière (20 cacas à la maison) — le total passe de 58 à 61.
- `UI.info()` — modale de lecture seule, utilisée par le détail d'une pastille.
- Migration `13_20260908_poopmap.sql` : colonnes `place`, `lat`, `lon` sur `poops`.
  **Appliquée en production le 2026-09-08** ; `savePoopCloud()` / `getMyPoops()`
  détectent l'absence des colonnes (PGRST204 / 42703) et rejouent la requête sans
  elles, donc l'app fonctionnait avant comme après — ce repli reste en place comme
  filet de sécurité.

### Corrigé
- Sync cloud → local : `isRetro` était relu sous le nom `p.is_retro`, que
  `getMyPoops()` ne renvoie pas (il mappe déjà vers `isRetro`). Les entrées
  récupérées depuis le cloud perdaient donc leur marque « ⏪ retard ».

### Modifié
- 🔧 Bump cache SW caca-v31 → caca-v32

## [2.13.0] — 2026-08-30

### Ajouté
- **🎉 Popup « Quoi de neuf »** au premier lancement suivant une mise à jour :
  liste des nouveautés, écrite pour l'utilisatrice et non pour un développeur.
  - Cumule **toutes** les versions sautées si on revient après plusieurs mises à jour
  - Ne s'affiche **pas** au tout premier lancement — l'onboarding s'en charge,
    enchaîner deux fenêtres serait pénible
  - Rejouable via « 🎉 Quoi de neuf ? » dans les Réglages
- `APP_VERSION` devient la **source de vérité unique** de la version : l'en-tête
  et les Réglages sont remplis à partir d'elle. Ces libellés étaient jusqu'ici
  écrits en dur et avaient déjà divergé par le passé.

### Modifié
- 🔧 Bump cache SW caca-v28 → caca-v29

## [2.12.0] — 2026-08-30

### Ajouté
- **✏️ Édition d'une entrée** : bouton crayon dans l'historique. Le drawer de saisie
  s'ouvre pré-rempli (texture, couleur, humeur, note, date) et enregistre sur place.
  Jusqu'ici il fallait supprimer puis re-saisir.
  - La date est toujours modifiable en édition : le toggle « caca en retard » est masqué
    (il décrit une saisie, pas une correction) et `isRetro` est préservé tel quel
  - `updated_at` est avancé à chaque modification, ce qui laisse la résolution de conflit
    multi-appareils (v2.7.0) faire gagner la version la plus récente
  - Côté cloud, `savePoopCloud` fait déjà un upsert sur `(user_id, local_id)` : la ligne
    est mise à jour, pas dupliquée. Fonctionne aussi hors ligne via la queue existante.

### Corrigé
- `.toggle-wrap` définissait `display: inline-flex` après le chargement de Tailwind et
  gagnait donc sur `.hidden` : le toggle restait visible quand on le masquait. Restreint
  en `.toggle-wrap:not(.hidden)`.
- Les trois `alert()` restants de la saisie remplacés par des toasts maison

### Modifié
- 🔧 Bump cache SW caca-v23 → caca-v24

## [2.11.0] — 2026-07-15

### Ajouté
- **💬 Commentaires / chambrage** sous chaque caca du feed (fil déroulant + suppression, RLS `comments`)
- **👉 Nudge / relance** : bouton sur les membres inactifs du jour → notif push (table `nudges` + worker)
- **🏅 Badges dans le feed** : le déblocage d'un achievement est partagé au groupe (table `feed_events`)
- **🎯 Défis hebdo thématiques tournants** : count / lève-tôt / hibou / régularité / arc-en-ciel / série (rotation auto par n° de semaine, scoring par type)
- **🏆 Hall of Fame** : palmarès des gagnantes hebdo (table `challenge_wins`, calculé par le worker + backfill 8 semaines) + 🏆×N à côté des noms
- **👑 Célébration gagnante** : overlay couronne + confettis quand tu remportes le défi de la semaine
- **👑 Couronne « reine du mois »** dans le header si #1 du podium mensuel (≥ 2 membres actifs)
- **📅 Récap hebdo « Wrapped »** : carte bilan de la semaine passée (total, championne, jour le + actif, réaction star), masquable
- **Réactions enrichies** : 8 emojis (ajout 😱 🤢 ⚡) + mise à jour optimiste (plus de re-render complet du feed)

### Modifié
- **Toasts + modales maison** (`js/ui.js`) en remplacement de tous les `prompt` / `alert` / `confirm`
- Worker push migré `Client` → `Pool` (jobs concurrents sans collision), nouveaux jobs nudges / badges / défis
- **Push badge** : le groupe n'est notifié que pour les badges rares (flag `rare` sur 6 achievements marquants ; type `badge_rare`) — tous les badges restent affichés au feed
- 🔧 Bump cache SW caca-v16 → caca-v18

## [2.10.0] — 2026-07-15

### Ajouté
- **⚡ Temps réel** : le feed social, le podium et les réactions se mettent à jour instantanément chez tous les membres (Supabase Realtime self-hosted, websocket via `caca-api.yannick-uhrig.com/realtime/v1`)
- **📲 Notifications push** (Web Push/VAPID, toggle dans Réglages) : réactions reçues + rappel « 24h sans caca » — envoyées par le worker `caca-push` du NAS, fonctionne app fermée
- **🃏 Streak tolérant** : un jour raté est pardonné (1 joker max par fenêtre de 7 jours)
- **🗓️ Podiums des mois passés** : top 3 des 3 derniers mois dans l'onglet Social
- Templates français pour les mails de confirmation, invitation et changement d'email

### Sécurité
- **La clé service_role ne transite plus par le navigateur** : la page admin passe par un proxy (`/admin/v1`, conteneur `caca-admin`) qui vérifie le JWT + `is_admin` côté serveur ; table `app_secrets` supprimée
- Backup quotidien de la base (03h45, rétention 14 j + copie offsite) et sondes Uptime Kuma (API + heartbeat backup)

### Supprimé
- Tables `hdd_*` (ancien tracker de prix de disques sans rapport avec l'app)
- 🔧 Bump cache SW caca-v15 → caca-v16

## [2.9.0] — 2026-07-14

### Modifié
- **Migration du backend Supabase cloud → NAS auto-hébergé** : la base (comptes, cacas, groupes, réactions, défis) tourne désormais sur le NAS Unraid (Postgres + GoTrue + PostgREST), exposée via `https://caca-api.yannick-uhrig.com` (Cloudflare Tunnel + Traefik)
- Nouvelle `SUPABASE_URL` + `SUPABASE_ANON_KEY` dans `js/supabase-client.js`
- Mails d'auth (confirmation, reset mot de passe) envoyés via Resend (`caca-tracker@yannick-uhrig.com`)
- 🔧 Bump cache SW caca-v14 → caca-v15

### Notes
- Toutes les données et tous les comptes ont été migrés à l'identique (mots de passe inchangés)
- Le projet Supabase cloud `fnljhknjmmteawwomehb` est remis en pause (plus utilisé)

## [2.5.1] — 2026-02-19

### Ajouté
- **Page Admin ⚙️** (`admin.html`) : tableau de bord d'administration protégé par rôle `is_admin`
  - Liste de tous les comptes (avatar, pseudo, email, date d'inscription, dernière connexion, rôle)
  - Promouvoir / rétrograder n'importe quel utilisateur en admin en un clic
  - Changer le mot de passe : envoi d'un email de reset **ou** changement direct via la clé service role
  - Statistiques rapides (total, admins, actifs 7 j, connectés aujourd'hui)
  - Recherche et actualisation en temps réel
- **Lien Administration** dans le profil utilisateur (visible uniquement pour les admins)

### Corrigé
- **Synchroniser mes données** : correction de l'erreur systématique lors de la sync
  - Cause 1 : contrainte `UNIQUE (user_id, local_id)` manquante → `upsert onConflict` échouait toujours
  - Cause 2 : champ `mood` (v2.5.0) absent de la table `poops` → l'upsert rejetait les données
  - Fix SQL dans `supabase-admin.sql` + `onConflict: 'user_id,local_id'` dans le client
- **Dernière connexion** : `last_login` mis à jour dans `profiles` à chaque connexion

### SQL à exécuter dans Supabase
- `supabase-admin.sql` : colonnes `is_admin` + `email` + `last_login` + `mood` + contrainte unique + promotion Yannick

---

## [2.5.0] — 2026-02-19

### Ajouté
- **Humeur sur les entrées 😊** (A) : 4 boutons humeur dans le drawer (Normal / Douloureux / Urgent / Difficile) — humeur enregistrée avec chaque caca et affichée dans l'historique
- **Détail du jour — clic heatmap 📅** (B) : cliquer sur un jour coloré de la heatmap ouvre une modal listant tous les cacas de ce jour (heure, texture, couleur, commentaire, humeur)
- **Comparaison mensuelle 📊** (C) : card dans l'onglet Stats comparant ce mois-ci vs le mois précédent (nombre de cacas, évolution en %, jours actifs)
- **Streak d'objectifs 🔥** (D) : sous la barre d'objectif du Dashboard, affichage du nombre de jours consécutifs où l'objectif a été atteint
- **Score santé intestinale 🏥** (E) : card dans l'onglet Stats avec note A/B/C/D basée sur la régularité des intervalles, le coefficient de variation et le streak
- **Mode Timer ⏱️** (F) : bouton chrono dans le header — démarre une séance, affiche un overlay flottant avec durée en temps réel, arrêter ouvre le drawer avec la durée pré-remplie dans le commentaire
- **Swipe entre onglets 👆** (H) : navigation par glissement gauche/droite sur mobile (seuil 60px), désactivé quand le drawer ou une modal est ouverte
- **Sons personnalisés 📁** (I) : dans les réglages sons, bouton d'import de fichier audio par texture — le son est encodé en base64 et sauvegardé en localStorage, bouton ✕ pour le supprimer

---

## [2.4.1] — 2026-02-19

### Corrigé
- **Mise à jour mobile** : le téléphone restait bloqué sur l'ancienne version PWA même après déploiement
- **SW v4 — network-first pour HTML** : `index.html` est toujours récupéré depuis le réseau (plus jamais servi depuis le cache) → les mises à jour sont immédiatement visibles
- **`updateViaCache: 'none'`** : le navigateur ne met plus `sw.js` en cache HTTP, il détecte donc chaque nouvelle version du SW
- **Bannière "Mise à jour disponible"** : s'affiche en haut de l'écran quand une nouvelle version est prête → un tap recharge et applique la mise à jour

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
