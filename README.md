# 💩 Les cacas de Clémence — Caca-Tracker 3000 Deluxe

> Application mobile-first de suivi des selles — 100% fun, pour Clémence 💖

[![PWA](https://img.shields.io/badge/PWA-compatible-brightgreen)](#)
[![Vanilla JS](https://img.shields.io/badge/Vanilla%20JS-no%20framework-yellow)](#)
[![Version](https://img.shields.io/badge/version-2.11.0-orange)](#)
[![Supabase](https://img.shields.io/badge/Backend-Supabase%20self--hosted%20(NAS)-3ECF8E)](#)

---

## 📱 Fonctionnalités

### Dashboard
- Compteur du jour et total général
- Tonnage estimé (150 g/caca)
- Bouton 💩 pour enregistrer un caca
- Graphique des 7 derniers jours (Chart.js)
- Blague de merde du jour 🤣
- Prédiction du prochain caca 🔮

### Saisie d'un caca
- **6 textures** : Normal, Dur, Mou, Spray, Liquide, Explosif
- **6 couleurs** : Marron, Jaune, Vert, Noir, Arc-en-ciel, Rouge
- **Note** libre (optionnel)
- **Mode rétro** : saisir une date/heure passée
- **Son personnalisé** par texture 🔊

### Stats
- Comparaison Clémence / France / Monde
- Transit intestinal moyen
- Répartition des textures et couleurs
- Graphiques avancés : horaire, par jour, tendance mensuelle
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
| + 10 achievements | Régularité, Streak, Hibou, Lève-tôt… |

### Social ☁️ (Supabase)
- **Compte utilisateur** : inscription email/password + avatar emoji (30 choix)
- **Sync cloud bidirectionnelle** : données poussées ET récupérées depuis le cloud (fonctionne sur nouveau navigateur)
- **Groupes** : créer un groupe et inviter ses amies avec un code ou un QR code 📷
- **Permissions d'invitation** : le créateur peut autoriser/restreindre le partage du code
- **Podium 🏆** : classement mensuel des membres
- **Comparatif 📊** : barres côte à côte (cacas/7j)
- **Feed 📣** : activité du groupe avec onglets (Aujourd'hui / Semaine / Mois / Année) + filtre par membre
- **Défi hebdomadaire 🎯** : qui fera le plus cette semaine ?
- **Réactions emoji** : 💩🔥👑🤣❤️ sur les entrées du feed
- **Mot de passe oublié** : réinitialisation par email

### Historique & Paramètres
- Historique avec suppression individuelle
- Export JSON 📤
- Import JSON 📥 (fusion sans doublons)
- Réglages sons par texture 🔊
- Version de l'app

### UX
- **16 thèmes** : Chaud / Dark / Médical / Kawaii / Forêt / Océan / Sunset / Galaxy / Sakura / Mint / Lavande / Rose-Gold / Tropicale / Nordique / Automne / Neon
- **Sélecteur de thème et d'avatar** dans le profil utilisateur
- **Streak** 🔥 affiché dans le header
- **Icône Superman 🦸** dans le header pour les admins
- **Export JSON** 📤 visible directement dans l'onglet Stats
- **PWA** installable sur iPhone (mode standalone)
- **Offline** : fonctionne sans connexion (localStorage)

---

## 🛠️ Stack technique

| Technologie | Usage |
|-------------|-------|
| HTML5 / CSS3 | Structure & styles |
| Vanilla JS | Logique applicative |
| Tailwind CSS (compilé local) | Classes utilitaires |
| Chart.js 4.4 (vendorée) | Graphiques |
| qrcode 1.5.3 (bundlée) | QR code d'invitation |
| Icônes SVG inline | Sprite maison (9 icônes) — remplace Font Awesome |
| Fredoka / Space Mono | Polices auto-hébergées (woff2 latin + latin-ext) |
| localStorage | Persistance locale |
| Supabase (auto-hébergé) | Auth + DB + Social + Realtime — sur le NAS Unraid depuis v2.9.0 |
| Web Push (VAPID) | Notifications (worker `caca-push`) |
| Service Worker | Offline / PWA |

---

## 🚀 Lancer l'application

### Serveur local (recommandé pour PWA)
```bash
npx serve .
```
Puis ouvrir [http://localhost:3000](http://localhost:3000)

### Installation iPhone
1. Ouvrir dans Safari
2. Appuyer sur **Partager** ↗️
3. "Sur l'écran d'accueil"

---

## ⚙️ Configuration Supabase

> Depuis v2.9.0, le backend est un **Supabase auto-hébergé sur le NAS Unraid**
> (`https://caca-api.yannick-uhrig.com`, stack `compose-stacks/caca-supabase`).
> Le projet cloud d'origine est en pause.

Pour repartir d'une instance neuve (cloud ou self-hosted) :

1. Provisionner l'instance (projet [supabase.com](https://supabase.com) ou stack Docker self-hosted)
2. **SQL Editor** → jouer les migrations de `supabase/migrations/` dans l'ordre numérique
   ⚠️ Voir `supabase/SCHEMA.md` : les migrations du dépôt **ne reproduisent pas**
   la base de production à elles seules (6 tables de v2.10/v2.11 y manquent).
3. Dans `js/supabase-client.js`, renseigner :
```js
const SUPABASE_URL      = 'https://VOTRE_INSTANCE';
const SUPABASE_ANON_KEY = 'VOTRE_ANON_KEY';
```

---

## 📁 Structure des fichiers

```
Caca-Tracker/
├── index.html              ← App principale (structure + logique core)
├── admin.html              ← Tableau de bord admin (rôle is_admin)
├── manifest.json           ← Manifest PWA
├── sw.js                   ← Service Worker (cache offline + Web Push)
├── favicon.svg             ← Favicon emoji 💩
├── supabase/
│   ├── SCHEMA.md           ← État réel de la base (introspection PostgREST)
│   ├── SECURITE-RLS.md     ← Audit RLS et correctif proposé
│   └── migrations/         ← Migrations numérotées 01 → 12
├── email-templates/        ← Templates mail FR (confirmation, invite, recovery…)
├── css/
│   └── styles.css          ← Styles des modules v2.0
└── js/
    ├── supabase-client.js  ← Client Supabase (auth + DB + sync)
    ├── social.js           ← Module social (groupes, podium, feed, défis)
    ├── ui.js               ← Toasts + modales maison
    ├── push.js             ← Abonnement Web Push
    ├── sounds.js           ← Sons par texture + contrôle volume
    ├── jokes.js            ← 30+ blagues rotatives
    ├── achievements.js     ← Système d'achievements
    ├── predictions.js      ← Moteur de prédiction
    ├── charts.js           ← Graphiques avancés
    └── animations.js       ← Effets visuels
```

---

## 💾 Données

- **Local** : `localStorage` (clé `cacaTracker.v2`), max 2 000 entrées
- **Cloud** : Supabase PostgreSQL (sync automatique à la connexion)
- **Export** : bouton JSON dans l'onglet Historique
- **Import** : fusion intelligente (pas de doublons)

---

## 👩‍💻 Auteur

**Papa de Clémence** — Développeur fun & fier 🚀
Fait avec ❤️ et beaucoup de 💩
