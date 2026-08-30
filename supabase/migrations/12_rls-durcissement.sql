-- ============================================================
--  12 — Durcissement RLS
--  Corrige la lecture anonyme de `profiles` (emails) et `groups`
--  (codes d'invitation). Voir supabase/SECURITE-RLS.md.
--
--  ✅ APPLIQUÉ en production le 2026-08-30 sur caca-db (NAS Unraid).
--
--  ORDRE DE DÉPLOIEMENT — le code applicatif d'abord, ce fichier ensuite.
--  findGroupByInvite() (js/supabase-client.js) essaie la fonction SQL puis
--  retombe sur la lecture directe de `groups` si elle n'existe pas encore
--  (erreur PGRST202). Le JS fonctionne donc AVANT comme APRÈS cette migration,
--  et rejoindre un groupe ne casse à aucun moment.
--  Une fois ce fichier appliqué, le repli devient inatteignable (la policy
--  permissive disparaît) et pourra être retiré du JS.
--
--  À passer dans une transaction pour pouvoir tout annuler :
--      BEGIN;  \i 12_rls-durcissement.sql   -- puis vérifier, puis COMMIT;
-- ============================================================

-- ------------------------------------------------------------
-- 0. Constat préalable — à lire AVANT d'appliquer
--    Si relrowsecurity vaut false sur profiles, c'est la cause
--    directe de la fuite.
-- ------------------------------------------------------------
-- SELECT relname, relrowsecurity FROM pg_class
--  WHERE relnamespace = 'public'::regnamespace AND relkind = 'r';
-- SELECT tablename, policyname, roles, cmd, qual
--   FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;

-- ------------------------------------------------------------
-- 1. RLS active partout, sans exception
-- ------------------------------------------------------------
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poops               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nudges              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_wins      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_reminder_state ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 2. profiles — soi-même, ses co-équipières, les admins
--    On repart de zéro : toute policy SELECT permissive ajoutée
--    à la main hors dépôt est supprimée ici.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Profiles visibles par tous"           ON public.profiles;
DROP POLICY IF EXISTS "Voir son propre profil"              ON public.profiles;
DROP POLICY IF EXISTS "Voir profils des membres du groupe"  ON public.profiles;
DROP POLICY IF EXISTS "Profils publics"                     ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users"    ON public.profiles;

CREATE POLICY "profiles_select_self_group_admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR public.shares_group_with(id)
    OR public.is_admin()
  );

-- ------------------------------------------------------------
-- 3. groups — plus de USING (true)
--    Le lookup par code passe par une fonction SECURITY DEFINER
--    qui ne renvoie que l'id et le nom, et rien d'autre.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Lookup par code invitation"      ON public.groups;
DROP POLICY IF EXISTS "Voir groupes dont on est membre" ON public.groups;

CREATE POLICY "groups_select_member_or_creator"
  ON public.groups FOR SELECT
  TO authenticated
  USING (
    auth.uid() = created_by
    OR public.is_group_member(id)
    OR public.is_admin()
  );

CREATE OR REPLACE FUNCTION public.find_group_by_invite(code text)
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id, g.name
  FROM public.groups g
  WHERE g.invite_code = upper(trim(code))
  LIMIT 1;
$$;

REVOKE ALL     ON FUNCTION public.find_group_by_invite(text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.find_group_by_invite(text) TO authenticated;

-- ------------------------------------------------------------
-- 4. Vérification — doit renvoyer 0 ligne pour chaque table
--    Rejouer ensuite la sonde anonyme :
--      curl -H "apikey: <clé anon>" \
--           "https://caca-api.yannick-uhrig.com/rest/v1/profiles?select=id"
--    Réponse attendue : []
-- ------------------------------------------------------------
-- SET LOCAL ROLE anon;
-- SELECT count(*) AS profiles_visibles_anon FROM public.profiles;  -- attendu 0
-- SELECT count(*) AS groups_visibles_anon   FROM public.groups;    -- attendu 0
-- RESET ROLE;
