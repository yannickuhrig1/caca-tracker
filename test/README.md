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
| `backfill.test.js` | `poopMapEntriesToPush` | choisit ce qui remonte une fois vers le cloud : trop étroit, des lieux restent bloqués sur un seul téléphone |

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
