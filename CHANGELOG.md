# Changelog — Caca-Tracker 3000 Deluxe

Toutes les modifications notables sont documentées ici.
Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

---

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
