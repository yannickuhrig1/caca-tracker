-- ============================================================
--  16 — Jeux du trône : classement hebdomadaire (v2.19.0)
--
--  `game_scores` garde, pour chaque joueuse, jeu et semaine, son MEILLEUR
--  score. Une ligne par (user_id, game, week_start) : le client fait un
--  upsert, et un trigger empêche un score plus bas (autre téléphone, vieux
--  cache) d'écraser le record déjà enregistré.
--
--  Lecture : sa propre ligne, et celles des personnes avec qui on partage un
--  groupe (même règle que `poops`, via shares_group_with). Écriture : ses
--  propres lignes seulement.
--
--  Rien d'autre ne quitte le téléphone : parties jouées, badges de jeu et
--  jardin de la fosse restent en local.
--
--  ✅ APPLIQUÉE en production le 2026-09-17 sur caca-db (NAS Unraid),
--     après sauvegarde (pg_dump en supabase_admin : postgres n'est pas
--     superuser sur cette image). Vérifié : clé primaire (user_id, game,
--     week_start), 4 policies, RLS active, trigger game_scores_keep_best,
--     upsert d'un score plus bas sans effet sur le record (test en
--     transaction annulée, utilisatrice authentifiée simulée), table
--     illisible avec la clé anon via l'API (401, 42501), table vue par
--     PostgREST sans redémarrage.
--
--  ORDRE DE DÉPLOIEMENT — indifférent. Sans la table (PGRST205 / 42P01), le
--  client garde les scores en local, masque la carte du classement et
--  renvoie les meilleurs scores de la semaine dès que la table existe.
--
--  À appliquer depuis le NAS : scripts/apply-migrations.sh
-- ============================================================

CREATE TABLE IF NOT EXISTS public.game_scores (
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game       text        NOT NULL,
  week_start bigint      NOT NULL,
  score      integer     NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game, week_start)
);

ALTER TABLE public.game_scores DROP CONSTRAINT IF EXISTS game_scores_game_known;
ALTER TABLE public.game_scores
  ADD CONSTRAINT game_scores_game_known
  CHECK (game IN ('plop', 'pq', 'colon', 'course', 'quiz'));

-- Bornes larges : on arrête les valeurs absurdes, pas les bonnes joueuses.
ALTER TABLE public.game_scores DROP CONSTRAINT IF EXISTS game_scores_score_range;
ALTER TABLE public.game_scores
  ADD CONSTRAINT game_scores_score_range
  CHECK (score >= 0 AND score <= 100000);

COMMENT ON TABLE public.game_scores IS
  'Jeux du trône : meilleur score de la semaine par joueuse et par jeu';
COMMENT ON COLUMN public.game_scores.week_start IS
  'Lundi 00:00 de la semaine, epoch ms en heure locale du client (comme poops.date)';

CREATE INDEX IF NOT EXISTS game_scores_week_idx ON public.game_scores (week_start, game);

-- ------------------------------------------------------------
-- Le meilleur score gagne toujours
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.game_scores_keep_best()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.score < OLD.score THEN
    NEW.score := OLD.score;
    NEW.updated_at := OLD.updated_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS game_scores_keep_best ON public.game_scores;
CREATE TRIGGER game_scores_keep_best
  BEFORE UPDATE ON public.game_scores
  FOR EACH ROW EXECUTE FUNCTION public.game_scores_keep_best();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_scores_select_group" ON public.game_scores;
DROP POLICY IF EXISTS "game_scores_insert_own"   ON public.game_scores;
DROP POLICY IF EXISTS "game_scores_update_own"   ON public.game_scores;
DROP POLICY IF EXISTS "game_scores_delete_own"   ON public.game_scores;

CREATE POLICY "game_scores_select_group"
  ON public.game_scores FOR SELECT
  USING (auth.uid() = user_id OR public.shares_group_with(user_id));
CREATE POLICY "game_scores_insert_own"
  ON public.game_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "game_scores_update_own"
  ON public.game_scores FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "game_scores_delete_own"
  ON public.game_scores FOR DELETE USING (auth.uid() = user_id);

REVOKE ALL ON public.game_scores FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_scores TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Vérification :
--   SELECT tablename, policyname FROM pg_policies WHERE tablename = 'game_scores';
--   SELECT tgname FROM pg_trigger WHERE tgname = 'game_scores_keep_best';
