-- ============================================================
--  17 — Le Grand Transit au classement des jeux (v2.20.0)
--
--  `game_scores.game` n'acceptait que les cinq jeux de la v2.19.0. Cette
--  migration ajoute 'transit' à la liste autorisée. Rien d'autre ne change :
--  ni colonne, ni policy, ni trigger.
--
--  ✅ APPLIQUÉE en production le 2026-09-17 sur caca-db (NAS Unraid), après
--     sauvegarde (pg_dump en supabase_admin, 628 Ko). Vérifié : la contrainte
--     liste bien 'transit', RLS toujours active avec ses 4 policies, trigger
--     game_scores_keep_best en place, GET /game_scores en 200 via PostgREST
--     sans redémarrage, et 42501 (permission denied) avec la clé anon, comme
--     avant. Les lignes existantes n'ont pas bougé.
--
--  ORDRE DE DÉPLOIEMENT — indifférent. Sans elle, la base refuse le score
--  (violation de contrainte 23514) ; le client le détecte, garde le score en
--  local et cesse de réessayer pour la session. Le classement des autres jeux
--  continue de fonctionner.
--
--  À appliquer depuis le NAS : scripts/apply-migrations.sh
-- ============================================================

ALTER TABLE public.game_scores DROP CONSTRAINT IF EXISTS game_scores_game_known;
ALTER TABLE public.game_scores
  ADD CONSTRAINT game_scores_game_known
  CHECK (game IN ('plop', 'pq', 'colon', 'course', 'quiz', 'transit'));

NOTIFY pgrst, 'reload schema';

-- Vérification :
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname = 'game_scores_game_known';
