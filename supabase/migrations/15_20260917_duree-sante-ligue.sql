-- ============================================================
--  15 — Durée, carnet de santé privé, ligue entre groupes (v2.18.0)
--
--  1. `poops.duration_s` : durée de la séance en secondes, mesurée par le
--     chrono ou saisie à la main. Visible du groupe comme le reste de la
--     ligne : elle alimente le classement « Reine de l'endurance ».
--
--  2. `poop_health` : symptômes et contexte (ballonnements, sang, règles,
--     café, épicé…). Table À PART, lisible par sa seule propriétaire :
--     la policy « Voir cacas des membres du groupe » de `poops` porte sur la
--     ligne entière, une colonne de `poops` aurait donc été lisible par les
--     copines. Clé logique (user_id, local_id), comme `poops`.
--
--  3. Ligue entre groupes : `groups.league_opt_in` (faux par défaut, seul le
--     créateur le change grâce à la policy UPDATE de la migration 09) et la
--     fonction `group_league(week_start)`. Elle ne renvoie que des agrégats
--     des groupes inscrits : nom, membres, cacas de la semaine. Aucune ligne
--     de `poops` ne sort, aucun nom de membre non plus.
--
--  ✅ APPLIQUÉE en production le 2026-09-17 sur caca-db (NAS Unraid),
--     après sauvegarde (pg_dump en supabase_admin : postgres n'est pas
--     superuser sur cette image). Vérifié : colonne, 4 policies, RLS active,
--     group_league SECURITY DEFINER non exécutable par anon, poop_health
--     illisible par une autre membre du même groupe (test en transaction
--     annulée), duration_s exposée par PostgREST sans redémarrage.
--
--  ORDRE DE DÉPLOIEMENT — indifférent. Le client détecte l'absence de la
--  colonne (PGRST204 / 42703), de la table (PGRST205 / 42P01) ou de la
--  fonction (PGRST202 / 42883) et se passe de la fonctionnalité : la durée
--  reste en local, le carnet de santé aussi, la carte de ligue est masquée.
--
--  À appliquer depuis le NAS : scripts/apply-migrations.sh
-- ============================================================

-- ------------------------------------------------------------
-- 1. Durée
-- ------------------------------------------------------------
ALTER TABLE public.poops
  ADD COLUMN IF NOT EXISTS duration_s integer;

ALTER TABLE public.poops
  DROP CONSTRAINT IF EXISTS poops_duration_range;

-- 0 exclu (pas de mesure = NULL), 3 h max : au-delà c'est un chrono oublié.
ALTER TABLE public.poops
  ADD CONSTRAINT poops_duration_range
  CHECK (duration_s IS NULL OR (duration_s > 0 AND duration_s <= 10800));

COMMENT ON COLUMN public.poops.duration_s IS
  'Durée de la séance en secondes (chrono ou saisie), NULL si non mesurée';

-- ------------------------------------------------------------
-- 2. Carnet de santé privé
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.poop_health (
  user_id    uuid   NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  local_id   text   NOT NULL,
  tags       text[] NOT NULL DEFAULT '{}',
  updated_at bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, local_id)
);

COMMENT ON TABLE public.poop_health IS
  'Symptômes et contexte d''une entrée. Privé : jamais lisible par le groupe.';

ALTER TABLE public.poop_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "poop_health_select_own" ON public.poop_health;
DROP POLICY IF EXISTS "poop_health_insert_own" ON public.poop_health;
DROP POLICY IF EXISTS "poop_health_update_own" ON public.poop_health;
DROP POLICY IF EXISTS "poop_health_delete_own" ON public.poop_health;

CREATE POLICY "poop_health_select_own"
  ON public.poop_health FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "poop_health_insert_own"
  ON public.poop_health FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "poop_health_update_own"
  ON public.poop_health FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "poop_health_delete_own"
  ON public.poop_health FOR DELETE USING (auth.uid() = user_id);

REVOKE ALL ON public.poop_health FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poop_health TO authenticated;

-- ------------------------------------------------------------
-- 3. Ligue entre groupes
-- ------------------------------------------------------------
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS league_opt_in boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.groups.league_opt_in IS
  'Le groupe apparaît dans la ligue inter-groupes (agrégats seulement)';

-- week_start : lundi 00:00 de la semaine voulue, en epoch ms (heure locale
-- du client, comme `poops.date`). Score = cacas par membre, pour que la taille
-- du groupe ne décide pas du classement.
CREATE OR REPLACE FUNCTION public.group_league(week_start bigint)
RETURNS TABLE (
  group_id  uuid,
  name      text,
  members   integer,
  active    integer,
  total     integer,
  score     numeric,
  is_mine   boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    g.id,
    g.name,
    (SELECT count(*)::int FROM group_members gm WHERE gm.group_id = g.id),
    (SELECT count(DISTINCT p.user_id)::int
       FROM group_members gm JOIN poops p ON p.user_id = gm.user_id
      WHERE gm.group_id = g.id
        AND p.date >= week_start AND p.date < week_start + 7 * 86400000),
    (SELECT count(*)::int
       FROM group_members gm JOIN poops p ON p.user_id = gm.user_id
      WHERE gm.group_id = g.id
        AND p.date >= week_start AND p.date < week_start + 7 * 86400000),
    round(
      (SELECT count(*)
         FROM group_members gm JOIN poops p ON p.user_id = gm.user_id
        WHERE gm.group_id = g.id
          AND p.date >= week_start AND p.date < week_start + 7 * 86400000)::numeric
      / GREATEST(1, (SELECT count(*) FROM group_members gm WHERE gm.group_id = g.id)),
      2),
    public.is_group_member(g.id)
  FROM groups g
  WHERE g.league_opt_in
    AND auth.uid() IS NOT NULL
  ORDER BY 6 DESC, 5 DESC
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.group_league(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.group_league(bigint) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Vérification :
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'poops' AND column_name = 'duration_s';
--   SELECT tablename, policyname FROM pg_policies WHERE tablename = 'poop_health';
--   SELECT * FROM public.group_league(0);   -- en tant que postgres : auth.uid() NULL -> 0 ligne
