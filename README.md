# 💩 Caca-Tracker 3000 Deluxe

> Application mobile-first de suivi des selles — 100% fun, pour Clémence 💖

[![PWA](https://img.shields.io/badge/PWA-compatible-brightgreen)](#)
[![Vanilla JS](https://img.shields.io/badge/Vanilla%20JS-no%20framework-yellow)](#)
[![Version](https://img.shields.io/badge/version-2.0-orange)](#)

---

## 📱 Fonctionnalités

### Dashboard
- Compteur du jour et total général
- Tonnage estimé (150 g/caca)
- Bouton 💩 pour enregistrer un caca
- Graphique des 7 derniers jours (Chart.js)
- Confettis à l'ajout 🎉

### Saisie d'un caca
- **6 textures** : Normal, Dur, Mou, Spray, Liquide, Explosif
- **6 couleurs** : Marron, Jaune, Vert, Noir, Arc-en-ciel, Rouge
- **Note** libre (optionnel)
- **Mode rétro** : saisir une date/heure passée

### Stats
- Comparaison Clémence / France / Monde
- Transit intestinal moyen
- Répartition des textures
- Fun facts médicaux

### Badges 🏆
| Badge | Condition |
|-------|-----------|
| ⭐ Première Étoile | 1er caca |
| 🔥 Flamme x3 | 3 jours d'affilée |
| 🌈 Arc-en-Ciel | Couleur arc-en-ciel utilisée |
| 🏆 Vétéran | 10 cacas |
| ⏪ Archiviste | 1 caca en retard saisi |
| 🇫🇷 À la Française | ≥ 1.1/j sur 7 jours |
| 💯 Centenaire | 100 cacas |
| 🌙 Caca de nuit | Caca entre minuit et 5h |

### Modules v2.0
- **🤣 Blagues** : 30+ blagues rotatives basées sur la date
- **🔮 Prédictions** : estimation du prochain caca + heure moyenne + tendances
- **📊 Graphiques avancés** : répartition horaire, par jour, couleurs, textures, tendance mensuelle
- **🏆 Achievements** : 10 achievements déblocables (premier caca, streak, régularité…)
- **🔊 Sons** : 6 sons selon les actions
- **✨ Animations** : caca dansant, confettis arc-en-ciel, fireworks, streak

### UX
- **3 thèmes** : Chaud 🟠 / Dark 🌙 / Médical 🩺
- **Streak** 🔥 affiché dans le header
- **Historique** avec suppression individuelle + export JSON
- **PWA** installable sur iPhone (mode standalone)

---

## 🛠️ Stack technique

| Technologie | Usage |
|-------------|-------|
| HTML5 / CSS3 | Structure & styles |
| Vanilla JS | Logique applicative |
| Tailwind CSS (CDN) | Classes utilitaires |
| Chart.js 4.4 (CDN) | Graphique 7 jours |
| Font Awesome 6.4 | Icônes |
| Fredoka / Space Mono | Polices Google Fonts |
| localStorage | Persistance des données |
| Service Worker | Offline / PWA |

Aucune dépendance npm — tout fonctionne en ouvrant `Index.Html` dans un navigateur.

---

## 🚀 Lancer l'application

### Option 1 — Serveur local (recommandé pour PWA)
```bash
# Python
python -m http.server 8080

# Node
npx serve .
```
Puis ouvrir [http://localhost:8080](http://localhost:8080)

### Option 2 — Ouverture directe
Ouvrir `Index.Html` directement dans Chrome/Safari.
> ⚠️ Le Service Worker et certaines fonctionnalités PWA nécessitent un serveur HTTP.

### Installation iPhone
1. Ouvrir dans Safari
2. Appuyer sur **Partager** ↗️
3. "Sur l'écran d'accueil"

---

## 📁 Structure des fichiers

```
Caca-Tracker/
├── Index.Html          ← App principale (structure + logique core)
├── manifest.json       ← Manifest PWA
├── sw.js               ← Service Worker (cache offline)
├── css/
│   └── styles.css      ← Styles des modules v2.0
└── js/
    ├── sounds.js        ← Gestionnaire de sons
    ├── jokes.js         ← 30+ blagues rotatives
    ├── achievements.js  ← Système d'achievements
    ├── predictions.js   ← Moteur de prédiction
    ├── charts.js        ← Graphiques avancés
    └── animations.js    ← Effets visuels
```

---

## 💾 Données

- Stockage : `localStorage` (clé `cacaTracker.v2`)
- Max : 2 000 entrées (FIFO)
- Export : bouton JSON dans l'onglet Historique
- Aucun backend, aucun compte, 100% privé

---

## 👩‍💻 Auteur

**Papa de Clémence** — Développeur fun & fier 🚀
Fait avec ❤️ et beaucoup de 💩
