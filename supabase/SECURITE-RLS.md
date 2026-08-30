# Audit RLS — 2026-08-29

Sonde en lecture seule contre l'API de production, **avec la seule clé `anon`**
(publique, présente dans `js/supabase-client.js` du dépôt public) et **sans
aucun JWT** — c'est-à-dire ce que voit n'importe qui sur Internet.

Aucun contenu de ligne n'a été relevé, uniquement des codes HTTP et des compteurs.

## Résultat

| Table | Lecture anonyme | Verdict |
|---|--:|---|
| **`profiles`** | **10 lignes** | 🔴 **fuite** |
| **`groups`** | **3 lignes** | 🔴 **fuite** |
| `poops` | 0 | ✅ |
| `group_members` | 0 | ✅ |
| `comments` | 0 | ✅ |
| `reactions` | 0 | ✅ |
| `nudges` | 0 | ✅ |
| `feed_events` | 0 | ✅ |
| `challenges` | 0 | ✅ |
| `challenge_wins` | 0 | ✅ |
| `push_subscriptions` | 0 | ✅ |
| `push_reminder_state` | 0 | ✅ |

L'écriture anonyme est correctement bloquée (`POST` → `401` sur `profiles`,
`groups`, `comments`, `reactions`).

## Ce qui fuit exactement

**`profiles` — les 10 comptes, en entier.** La table contient `email` : les
**10 profils ont une adresse email non nulle**, toutes lisibles. Sont aussi
exposés `username`, `avatar`, `last_login` et `is_admin` (qui désigne
publiquement le compte administrateur — 1 sur 10).

**`groups` — les 3 groupes, `invite_code` compris.** Les 3 ont un code non nul.
Un code d'invitation lisible publiquement, c'est la porte d'entrée du groupe.

## Cause

Pour `groups`, elle est dans le dépôt — `08_20260220_all-fixes.sql:115` :

```sql
CREATE POLICY "Lookup par code invitation"
  ON public.groups FOR SELECT USING (true);
```

`USING (true)`, sans restriction de rôle. Les policies PostgreSQL se combinent
en **OU** : celle-ci rend donc toute la table lisible par tout le monde,
y compris le rôle `anon`. Elle existe pour que `joinGroup()` retrouve un groupe
à partir de son code — mais elle accorde bien plus que ce lookup.

Pour `profiles`, les policies du dépôt (`08_20260220_all-fixes.sql:207-211`) sont
correctes (`auth.uid() = id` ou `shares_group_with(id)`) et ne peuvent pas
renvoyer de ligne à un anonyme. La production laisse pourtant tout lire : il y a
donc **une divergence entre le dépôt et la base** — soit une policy permissive
ajoutée à la main, soit RLS jamais activé sur cette table. Impossible de
trancher depuis PostgREST (`pg_policies` n'est pas exposé) ; il faut regarder
en base :

```sql
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'profiles';
SELECT policyname, roles, cmd, qual FROM pg_policies WHERE tablename = 'profiles';
```

## Correctif proposé

`migrations/12_rls-durcissement.sql` — **non appliqué**, à relire puis à jouer
manuellement. Il :

1. force `ENABLE ROW LEVEL SECURITY` sur les 12 tables ;
2. supprime la policy `USING (true)` sur `groups` ;
3. remplace le lookup par code par une fonction `SECURITY DEFINER`
   `find_group_by_invite(code)` qui ne renvoie que `id` + `name`, réservée aux
   utilisateurs authentifiés ;
4. recrée les policies de `profiles` (soi-même, membres du même groupe, admin).

### Côté application — déjà en place

`findGroupByInvite()` (`js/supabase-client.js`) appelle d'abord la fonction SQL,
et retombe sur la lecture directe de `groups` si elle n'existe pas encore
(erreur PostgREST `PGRST202`). Le JS fonctionne donc **avant comme après** la
migration : rejoindre un groupe ne casse à aucun moment, quel que soit l'ordre.

Une fois la migration appliquée, le repli devient inatteignable — la policy
permissive ayant disparu — et pourra être retiré.

Couvert par `test/join-group.test.js` : chemin nominal, repli sur `PGRST202`,
double échec, code vide, normalisation du code.

## Marche à suivre

1. ✅ Déployer le code applicatif (fait — il gère les deux états)
2. ⬜ Relire puis jouer `migrations/12_rls-durcissement.sql` sur le Postgres du NAS,
   dans une transaction
3. ⬜ Rejouer la sonde anonyme ci-dessous : elle doit renvoyer `[]`
4. ⬜ Vérifier dans l'app qu'on peut toujours rejoindre un groupe par code
5. ⬜ Prévenir les 10 personnes concernées

```bash
curl -s -H "apikey: <clé anon>" \
  "https://caca-api.yannick-uhrig.com/rest/v1/profiles?select=id"   # attendu : []
curl -s -H "apikey: <clé anon>" \
  "https://caca-api.yannick-uhrig.com/rest/v1/groups?select=id"     # attendu : []
```

## Au-delà du correctif

- Vérifier si le dépôt GitHub doit rester public : la clé `anon` y est, ce qui
  est par conception, mais cela suppose que la RLS soit irréprochable.
