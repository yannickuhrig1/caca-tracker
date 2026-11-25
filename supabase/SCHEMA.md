# Schéma de la base — état réel

> Relevé le **2026-08-29** par introspection de l'API PostgREST de production
> (`https://caca-api.yannick-uhrig.com/rest/v1/`, spec OpenAPI, lecture seule).
> C'est la **source de vérité** : les migrations du dossier `migrations/` ne
> décrivent qu'une partie de cet état (voir « Dérive » plus bas).

## Tables (12)

| Table | Colonnes | Rôle |
|---|--:|---|
| `profiles` | 7 | comptes : `username`, `avatar`, `email`, `is_admin`, `last_login` |
| `poops` | 11 | les entrées : `date` (epoch ms), `texture`, `color`, `comment`, `is_retro`, `mood`, `local_id`, `updated_at` — + `place`, `lat`, `lon` (migration `13`) et `city`, `region`, `country`, `country_code` (migration `14`), appliquées le 2026-09-08 |
| `groups` | 6 | groupes : `name`, `created_by`, `invite_code`, `allow_member_invite` |
| `group_members` | 3 | appartenance (PK composite `group_id` + `user_id`) |
| `comments` | 5 | commentaires sous une entrée du feed |
| `reactions` | 5 | réactions emoji sur une entrée |
| `nudges` | 6 | relances entre membres (`from_user`, `to_user`, `emoji`) |
| `feed_events` | 7 | événements du feed (badges partagés) : `type`, `ref`, `title`, `emoji` |
| `challenges` | 7 | défi hebdomadaire d'un groupe : `type`, `title`, `start_date`, `end_date` |
| `challenge_wins` | 8 | palmarès Hall of Fame : `week_start`, `challenge_type`, `score` |
| `push_subscriptions` | 6 | abonnements Web Push : `endpoint`, `p256dh`, `auth` |
| `push_reminder_state` | 2 | anti-spam du rappel 24 h : `last_reminder_at` |

## Fonctions exposées

- `is_admin()` — le compte courant est-il administrateur
- `is_group_member(group_id)` — appartenance au groupe
- `shares_group_with(user_id)` — partage-t-on un groupe avec cet utilisateur

## Dérive entre le dépôt et la production

Les migrations `01` à `11` datent de **février 2026**. Les 6 tables ajoutées
lors des versions v2.10.0 et v2.11.0 (juillet 2026) avaient été créées
**directement en base** sans fichier SQL correspondant ; elles sont désormais
reconstituées de manière strictement idempotente dans
`migrations/00_baseline_missing_tables.sql` :

| Table en production | Migration au dépôt |
|---|---|
| `comments` | ✅ `00_baseline_missing_tables.sql` (rattrapage idempotent) |
| `nudges` | ✅ `00_baseline_missing_tables.sql` (rattrapage idempotent) |
| `feed_events` | ✅ `00_baseline_missing_tables.sql` (rattrapage idempotent) |
| `challenge_wins` | ✅ `00_baseline_missing_tables.sql` (rattrapage idempotent) |
| `push_subscriptions` | ✅ `00_baseline_missing_tables.sql` (rattrapage idempotent) |
| `push_reminder_state` | ✅ `00_baseline_missing_tables.sql` (rattrapage idempotent) |

Dans l'autre sens, la migration `11_20260221_secrets.sql` crée une table
`app_secrets` **supprimée depuis** (v2.10.0, la clé service_role ne transite
plus par le navigateur). Elle est conservée pour l'historique mais ne doit
**pas** être rejouée sur une base neuve.

Pour **repartir d'une base vierge** sans aucune table manquante, exécuter dans
l'ordre :

1. `01_20260218_schema.sql` → `10_20260221_updated-at.sql` (socle initial :
   `profiles`, `groups`, `group_members`, `poops`, `challenges`, `reactions` et
   fonctions `is_group_member` / `shares_group_with` / `is_admin`) — **en
   ignorant `11_20260221_secrets.sql`** ;
2. `00_baseline_missing_tables.sql` (les 6 tables v2.10/v2.11 ci-dessus, avec
   leurs index, RLS, policies protégées contre `duplicate_object` et
   `NOTIFY pgrst, 'reload schema'`) ;
3. `12_rls-durcissement.sql` → `19_20260928_group-map.sql`.

Sur une base déjà en production, `00_baseline_missing_tables.sql` est sans
effet destructif (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
policies ignorées si déjà présentes).

Enfin, `13_20260908_poopmap.sql` (`place`, `lat`, `lon`) et
`14_20260908_poopmap-conquete.sql` (`city`, `region`, `country`,
`country_code`) ont été **appliquées le 2026-09-08** avec
`scripts/apply-migrations.sh` (une transaction par fichier, vérification des
colonnes, rechargement du cache de schéma PostgREST). Contrôlé côté API : la
spec OpenAPI de `caca-api.yannick-uhrig.com` expose bien les sept colonnes.
Le repli côté client (détection de PGRST204 / 42703, requête rejouée sans ces
colonnes) reste en place comme filet de sécurité pour une base neuve ou
restaurée depuis un vieux dump.

## Migration 15 (v2.18.0)

`15_20260917_duree-sante-ligue.sql` ajoute `poops.duration_s`, la table privée
`poop_health` (RLS : propriétaire seulement), `groups.league_opt_in` et la
fonction `group_league(week_start)`. **Appliquée le 2026-09-17**, après un
dump complet fait en `supabase_admin` (sur cette image, `postgres` n'est pas
superuser et un dump complet avec lui peut échouer sur les schémas internes).
Vérifié : une membre du même groupe ne lit ni ne modifie les lignes
`poop_health` d'une autre ; avec la clé anon, `poop_health` et `group_league`
sont invisibles. Le repli côté client reste en place pour une base neuve.

À noter, hors périmètre : comme `poops` et `comments`, `poop_health` hérite
des droits par défaut de Supabase (`TRUNCATE`, `TRIGGER`, `REFERENCES` pour
`authenticated`). PostgREST n'expose pas `TRUNCATE` : pas exploitable par l'API.

Le worker `caca-push` n'envoie aucune notification pour les commentaires :
les stickers (`:sticker:id:`) n'ont donc rien à adapter côté serveur.

## Convention

- Un fichier par changement, préfixé d'un numéro d'ordre et de sa date :
  `NN_AAAAMMJJ_sujet.sql`
- **Jamais** modifier un fichier déjà appliqué en production : en ajouter un nouveau.
- Toute migration se termine par `NOTIFY pgrst, 'reload schema';` — sans ce
  signal, PostgREST continue de répondre PGRST204 sur les colonnes ajoutées.
- Toute nouvelle table doit arriver par une migration, pas par l'éditeur SQL.

## Migration 16 (v2.19.0)

`16_20260917_jeux-du-trone.sql` crée `game_scores` (clé `user_id, game,
week_start`) : meilleur score de la semaine par jeu des Jeux du trône. Un
trigger `BEFORE UPDATE` garde le plus haut score si un appareil envoie moins.
RLS : lecture de sa ligne et de celles des personnes d'un même groupe
(`shares_group_with`), écriture de ses propres lignes. **Appliquée le
2026-09-17**, après un dump complet fait en `supabase_admin`. Vérifié : clé
primaire, 4 policies, RLS active, trigger, score plus bas ignoré à l'upsert
(transaction annulée), table illisible avec la clé anon via l'API, table vue
par PostgREST sans redémarrage. Sans la table, le client masque la carte du
classement et garde les scores en local.

## Migration 17 (v2.20.0)

`17_20260918_grand-transit.sql` remplace la contrainte `game_scores_game_known`
pour accepter le jeu `transit` (Le Grand Transit). Rien d'autre ne change.
**Appliquée le 2026-09-17**, après un dump en `supabase_admin`. Vérifié : la
contrainte liste `transit`, RLS et ses 4 policies inchangées, trigger
`game_scores_keep_best` en place, table servie par PostgREST sans redémarrage
et toujours refusée à la clé anon (42501). Le repli côté client reste : sans la
migration, l'insertion est rejetée (23514), le score reste en local et le client
n'insiste pas.

## Migration 18 (v2.22.0)

`18_20260928_group-chat.sql` crée `group_messages` (id, group_id, user_id,
body ≤ 500, created_at) : le chat de groupe. RLS : lecture et envoi réservés
aux membres du groupe (`is_group_member`), suppression de ses propres messages.
La table est ajoutée de façon idempotente à la publication `supabase_realtime`
pour le fil en direct. **Non encore appliquée** : à jouer sur le NAS, comme
pour 15/16/17, avec un dump préalable en `supabase_admin`.

## Migration 19 (v2.22.0)

`19_20260928_group-map.sql` ajoute `profiles.geo_shared` (opt-in du partage de
position, défaut false) et `profiles.show_detailed_stats` (opt-out du détail
des stats, défaut true), et la fonction SECURITY DEFINER
`get_group_geo_poops(gid, since)` — l'unique porte d'accès aux coordonnées des
autres membres, qui n'applique l'opt-in qu'en base et ne remonte que la fenêtre
temporelle demandée. **Non encore appliquée.**

Les migrations s'appliquent depuis le clone du dépôt sur le NAS,
`/mnt/user/appdata/compose-stacks/caca-supabase/caca-tracker`. Le dossier
`repo-migrations/` voisin est un instantané figé (13 → 16) qui s'exécute sans
erreur en sautant les migrations suivantes : ne pas l'utiliser.
