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

Les migrations `01` à `11` datent de **février 2026**. Les tables ajoutées
depuis (v2.10.0 et v2.11.0, juillet 2026) ont été créées **directement en base**
et n'ont **aucune migration correspondante** dans le dépôt :

| Table en production | Migration au dépôt |
|---|---|
| `comments` | ❌ absente |
| `nudges` | ❌ absente |
| `feed_events` | ❌ absente |
| `challenge_wins` | ❌ absente |
| `push_subscriptions` | ❌ absente |
| `push_reminder_state` | ❌ absente |

Dans l'autre sens, la migration `11_20260221_secrets.sql` crée une table
`app_secrets` **supprimée depuis** (v2.10.0, la clé service_role ne transite
plus par le navigateur). Elle est conservée pour l'historique mais ne doit
**pas** être rejouée sur une base neuve.

Conséquence : **rejouer `01` → `11` sur une base vierge ne reproduit pas la
production.** Il manquerait les 6 tables ci-dessus. Pour repartir de zéro,
il faut d'abord faire un `pg_dump --schema-only` de la base du NAS et en
faire une migration `00_baseline.sql`.

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
