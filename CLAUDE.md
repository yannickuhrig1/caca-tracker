# 💩 Caca-Tracker 3000 Deluxe - v2.10.0

> ☁️ **Backend** : Supabase **auto-hébergé sur le NAS Unraid** depuis v2.9.0 (2026-07-14) — API `https://caca-api.yannick-uhrig.com` (Traefik + Cloudflare Tunnel → Postgres/GoTrue/PostgREST, stack `compose-stacks/caca-supabase`). L'ancien projet cloud `fnljhknjmmteawwomehb` est en pause.

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
