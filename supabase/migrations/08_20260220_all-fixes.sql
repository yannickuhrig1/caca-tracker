-- ============================================================
-- 🔧 ALL-IN-ONE FIX — Caca-Tracker 3000 Deluxe v2.5.1
-- Colle ce SQL dans : Supabase > SQL Editor > New Query > Run
-- Ce fichier est IDEMPOTENT : safe à relancer plusieurs fois.
-- ============================================================
-- Contient :
--   1. Colonnes admin + email + last_login (profiles)
--   2. Colonne mood (poops)
--   3. Contrainte UNIQUE (user_id, local_id) — fix sync
--   4. Trigger handle_new_user mis à jour
--   5. Fonctions SECURITY DEFINER (is_group_member, shares_group_with, is_admin)
--   6. Toutes les RLS policies (groups, group_members, poops, challenges, profiles)
--   7. Promotion Yannick en admin
-- ============================================================

-- ============================================================
-- ÉTAPE 1 — Colonnes manquantes
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin   boolean      DEFAULT false,
  ADD COLUMN IF NOT EXISTS email      text,
  ADD COLUMN IF NOT EXISTS last_login timestamptz;

ALTER TABLE public.poops
  ADD COLUMN IF NOT EXISTS mood text;

-- ============================================================
-- ÉTAPE 2 — Contrainte UNIQUE composite sur poops
-- (sans ça, syncLocalToCloud échoue toujours)
-- ============================================================

-- Supprimer les doublons éventuels
DELETE FROM public.poops p1
USING public.poops p2
WHERE p1.id > p2.id
  AND p1.user_id  = p2.user_id
  AND p1.local_id = p2.local_id
  AND p1.local_id IS NOT NULL;

-- Remplacer l'index simple par une vraie contrainte UNIQUE
DROP INDEX IF EXISTS idx_poops_local_id;

ALTER TABLE public.poops
  DROP CONSTRAINT IF EXISTS poops_user_local_id_unique;

ALTER TABLE public.poops
  ADD CONSTRAINT poops_user_local_id_unique UNIQUE (user_id, local_id);

-- ============================================================
-- ÉTAPE 3 — Backfiller les emails depuis auth.users
-- ============================================================

UPDATE public.profiles p
SET    email = u.email
FROM   auth.users u
WHERE  p.id = u.id;

-- ============================================================
-- ÉTAPE 4 — Trigger handle_new_user (email inclus)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'avatar', '💩'),
    new.email
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN new;
END;
$$;

-- ============================================================
-- ÉTAPE 5 — Fonctions SECURITY DEFINER (anti-récursion RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_group_member(gid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = gid AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.shares_group_with(other_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid() AND gm2.user_id = other_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- ============================================================
-- ÉTAPE 6 — RLS : groups
-- ============================================================

DROP POLICY IF EXISTS "Lookup par code invitation"         ON public.groups;
DROP POLICY IF EXISTS "Voir groupes dont on est membre"    ON public.groups;
DROP POLICY IF EXISTS "Créer un groupe"                    ON public.groups;
DROP POLICY IF EXISTS "Supprimer son groupe"               ON public.groups;

CREATE POLICY "Lookup par code invitation"
  ON public.groups FOR SELECT USING (true);

CREATE POLICY "Voir groupes dont on est membre"
  ON public.groups FOR SELECT USING (
    auth.uid() = created_by OR public.is_group_member(id)
  );

CREATE POLICY "Créer un groupe"
  ON public.groups FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Supprimer son groupe"
  ON public.groups FOR DELETE USING (auth.uid() = created_by);

-- ============================================================
-- ÉTAPE 7 — RLS : group_members
-- ============================================================

DROP POLICY IF EXISTS "Membres visibles par les membres du groupe" ON public.group_members;
DROP POLICY IF EXISTS "Rejoindre un groupe"                        ON public.group_members;
DROP POLICY IF EXISTS "Quitter un groupe"                          ON public.group_members;
DROP POLICY IF EXISTS "Créateur peut retirer des membres"          ON public.group_members;

CREATE POLICY "Membres visibles par les membres du groupe"
  ON public.group_members FOR SELECT USING (
    public.is_group_member(group_members.group_id)
  );

CREATE POLICY "Rejoindre un groupe"
  ON public.group_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Quitter un groupe"
  ON public.group_members FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Créateur peut retirer des membres"
  ON public.group_members FOR DELETE USING (
    auth.uid() = (SELECT created_by FROM public.groups WHERE id = group_id)
  );

-- ============================================================
-- ÉTAPE 8 — RLS : poops
-- ============================================================

DROP POLICY IF EXISTS "Voir ses propres cacas"              ON public.poops;
DROP POLICY IF EXISTS "Voir cacas des membres du groupe"    ON public.poops;
DROP POLICY IF EXISTS "Insérer ses propres cacas"           ON public.poops;
DROP POLICY IF EXISTS "Modifier ses propres cacas"          ON public.poops;
DROP POLICY IF EXISTS "Supprimer ses propres cacas"         ON public.poops;

CREATE POLICY "Voir ses propres cacas"
  ON public.poops FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Voir cacas des membres du groupe"
  ON public.poops FOR SELECT USING (public.shares_group_with(poops.user_id));

CREATE POLICY "Insérer ses propres cacas"
  ON public.poops FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Modifier ses propres cacas"
  ON public.poops FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Supprimer ses propres cacas"
  ON public.poops FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- ÉTAPE 9 — RLS : challenges
-- ============================================================

DROP POLICY IF EXISTS "Membres voient les défis du groupe" ON public.challenges;
DROP POLICY IF EXISTS "Créer un défi dans son groupe"      ON public.challenges;

CREATE POLICY "Membres voient les défis du groupe"
  ON public.challenges FOR SELECT USING (
    public.is_group_member(challenges.group_id)
  );

CREATE POLICY "Créer un défi dans son groupe"
  ON public.challenges FOR INSERT WITH CHECK (
    public.is_group_member(challenges.group_id)
  );

-- ============================================================
-- ÉTAPE 10 — RLS : profiles
-- ============================================================

DROP POLICY IF EXISTS "Voir son propre profil"                    ON public.profiles;
DROP POLICY IF EXISTS "Voir profils des membres du groupe"        ON public.profiles;
DROP POLICY IF EXISTS "Modifier son propre profil"                ON public.profiles;
DROP POLICY IF EXISTS "Admins peuvent modifier tous les profils"  ON public.profiles;

CREATE POLICY "Voir son propre profil"
  ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Voir profils des membres du groupe"
  ON public.profiles FOR SELECT USING (public.shares_group_with(id));

CREATE POLICY "Modifier son propre profil"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins peuvent modifier tous les profils"
  ON public.profiles FOR UPDATE USING (public.is_admin());

-- ============================================================
-- ÉTAPE 11 — Promouvoir Yannick en admin
-- ============================================================

UPDATE public.profiles
SET    is_admin = true
WHERE  email = 'yannick.uhrig@gmail.com';

-- ============================================================
-- ✅ Vérification finale
-- ============================================================

SELECT id, username, email, is_admin, last_login
FROM   public.profiles
ORDER  BY is_admin DESC, created_at;
