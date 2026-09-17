# Tests

```bash
npm test
```

Aucune dépendance : le lanceur `node --test` intégré suffit.
**Node 22 minimum** — les motifs glob de `--test` sont arrivés en v21.
La CI les exécute sur chaque PR et sur `main`.

## Comment ça marche

L'app est faite de scripts classiques qui posent leurs fonctions dans la portée
globale du navigateur — pas d'`export`, pas de bundler. Plutôt que de réécrire
la moitié du code en modules ES juste pour pouvoir le tester, `helpers/load.js`
évalue les fichiers **tels qu'ils sont livrés** dans un contexte `node:vm` muni
de stubs minimalistes (`document`, `localStorage`, `navigator`…), puis récupère
les fonctions depuis ce contexte.

Conséquence utile : les tests portent sur le code réellement servi aux
utilisatrices, pas sur une copie adaptée qui pourrait diverger sans qu'on le
remarque.

## Ce qui est couvert

| Fichier | Cible | Pourquoi ça compte |
|---|---|---|
| `challenges.test.js` | `weeklyChallengeType`, `scoreChallenge`, `getChallengeMeta` | décident du classement d'un groupe : une erreur fausse le Hall of Fame et les couronnes |
| `streak.test.js` | `calculateStreak` | logique du joker 🃏, la plus subtile de l'app, affichée en permanence dans le header |
| `poopmap.test.js` | `placeStats`, `clusterPoints`, `geoStats`, `fitView`, projection slippy map | cadrent la carte et classent les lieux : un cadrage faux sort les pastilles de l'écran sans rien signaler |
| `history-search.test.js` | `filterLogs`, `historyFiltersActive`, `yearlyTotals` | décident de ce qui s'affiche dans l'historique : une erreur masque des entrées sans que rien ne le signale |
| `conquest.test.js` | `conquestStats`, `flagEmoji`, `computeBadges` | décernent (ou refusent) les trophées, et servent au calcul de la rareté dans le groupe |
| `csv-export.test.js` | `toCSV` | le fichier part dans un tableur : un guillemet mal échappé décale les colonnes en silence |
| `stats-charts.test.js` | `buildHourSlots`, `buildWeekdayBars`, `buildMonthlyTrend`, `buildShare` | créneaux horaires, semaine qui commence un lundi, fenêtre de 12 mois et variation comparée à la même portion du mois précédent |
| `bristol.test.js` | `bristolBreakdown` | verrouille le comptage : chaque selle une seule fois, pourcentages à 100 % |
| `calendar.test.js` | `buildMonthGrid` | place chaque caca sur sa case : un décalage d'un jour ne saute pas aux yeux sur un calendrier |
| `backfill.test.js` | `poopMapEntriesToPush` | choisit ce qui remonte une fois vers le cloud : trop étroit, des lieux restent bloqués sur un seul téléphone |
| `sante.test.js` | `durationStats`, `formatDuration`, `healthInsights`, `bloodAlert`, `usualEntry` | disent quelque chose de la santé de l'utilisatrice : une comparaison fausse ou une alerte manquée est pire que rien |
| `accueil-wrapped.test.js` | `streakDetails`, `jokerToAnnounce`, `mascotMood`, `mascotLevel`, `buildYearWrapped`, `shareCardData` | série et mascotte s'affichent tous les jours ; le Wrapped part en image sur les réseaux |
| `social-fun.test.js` | `parseSticker`, `groupStreak`, `enduranceRanking`, `leagueWeekStart` | la série du groupe désigne publiquement qui manque à l'appel |
| `jeux-core.test.js` | `jeuxSession`, `recordGame`, `unsyncedWeekScores`, `gameBadgeStates`, `gameOverMascot`, `gameLeaderboard` | le temps limité protège la santé : s'il ne coupe jamais, le jeu fait rester assise ; le classement est vu de tout le groupe |
| `jeux-arcade.test.js` | Plop!, Tour de PQ, Le Côlon, Course au trône (logique sans dessin) | un score faux ou un obstacle infranchissable gâchent la partie sans message d'erreur |
| `jeux-transit.test.js` | construction des organes, parois, bouclier, bonus, sauvegarde par organe | une porte qui ne s'ouvre jamais assez bloque la partie en silence ; une sauvegarde mal relue renvoie à la bouche |
| `mais.test.js` | `maisStart`, `maisFound`, `maisPending`, `transitVerdict`, `maisFormat` | c'est une mesure de santé montrable à un médecin : un calcul faux ne doit pas passer |
| `jeux-quiz-fosse.test.js` | `quizPool`, `quizQuestion`, `quizClues`, `quizAnswer`, `fosseGain`, `fosseBuy`, `fosseHarvest` | le quiz montre les cacas des copines : jamais les siens, jamais une donnée privée ; le jardin ne se paie pas à crédit |
| `badges-cloud-v218.test.js` | `BADGE_CATEGORIES`, `nextBadges`, `rarityTier`, `poopRow`, `dropMissingColumns`, `applyExtraFields` | un badge sans catégorie disparaît ; une base sans migration 15 ne doit pas faire perdre de caca |
| `themes-contrast.test.js` | variables de `css/app.css` | texte lisible (WCAG AA) sur les cartes des 16 thèmes |

## La suite détecte-t-elle vraiment les régressions ?

Vérifié par mutation : on casse volontairement le code source, on relance, on
attend du rouge.

| Mutation | Résultat |
|---|---|
| `early` : `getHours() < 8` → `<= 8` | ✅ détectée |
| joker : `i - lastJokerAt >= 7` → `>= 0` | ✅ détectée |
| `streak` : `d - prev === 86400000` → `>= 86400000` | ✅ détectée |
| `regular` : jours distincts → `poops.length` | ✅ détectée |
| `streak` : `=== 86400000` → `<= 86400000` | ⚪️ non détectée — **mutant équivalent** : les jours sont dédupliqués puis triés, l'écart ne vaut donc jamais 0 et `<=` se comporte exactement comme `===` |

## Ajouter un test

Attention aux valeurs qui traversent `node:vm` : elles viennent d'un autre
realm, donc `deepStrictEqual` refuse deux tableaux pourtant identiques. Comparer
des valeurs simples (longueur, `join('|')`) comme dans `poopmap.test.js`.

Viser les fonctions **pures** — celles qui prennent des données et rendent une
valeur, sans toucher au DOM. Les bons candidats restants : `getDailyJoke`
(`js/jokes.js`), le moteur de `js/predictions.js`, `toLocalDatetimeValue`
(`js/app/app-entries.js`).

Pour le reste, qui manipule le DOM, le test au navigateur reste plus adapté que
de stuber la moitié de l'API DOM.
