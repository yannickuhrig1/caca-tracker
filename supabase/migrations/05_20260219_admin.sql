-- ============================================================
-- 🔐 Administration — Caca-Tracker 3000 Deluxe
-- Colle ce SQL dans : Supabase > SQL Editor > New Query > Run
-- Prérequis : supabase-schema.sql + supabase-rls-fix.sql déjà exécutés
-- ============================================================

-- ============================================================
-- ÉTAPE 1 — Nouvelles colonnes
-- ============================================================

-- Colonnes admin dans profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin   boolean      DEFAULT false,
  ADD COLUMN IF NOT EXISTS email      text,
  ADD COLUMN IF NOT EXISTS last_login timestamptz;

-- Colonne mood dans poops (ajoutée en v2.5.0 côté app, absente du schéma)
ALTER TABLE public.poops
  ADD COLUMN IF NOT EXISTS mood text;

-- ============================================================
-- ÉTAPE 2 — Corriger la contrainte UNIQUE sur local_id
-- (sans contrainte unique, l'upsert onConflict échoue toujours)
-- ============================================================

-- Supprimer les éventuels doublons avant d'ajouter la contrainte
DELETE FROM public.poops p1
USING public.poops p2
WHERE p1.id > p2.id
  AND p1.user_id  = p2.user_id
  AND p1.local_id = p2.local_id
  AND p1.local_id IS NOT NULL;

-- Remplacer l'ancien index simple par une contrainte UNIQUE composite
DROP INDEX IF EXISTS idx_poops_local_id;

ALTER TABLE public.poops
  DROP CONSTRAINT IF EXISTS poops_user_local_id_unique;

ALTER TABLE public.poops
  ADD CONSTRAINT poops_user_local_id_unique UNIQUE (user_id, local_id);

-- ============================================================
-- ÉTAPE 3 — Backfiller les emails depuis auth.users
-- (les utilisateurs existants n'ont pas encore l'email dans profiles)
-- ============================================================

UPDATE public.profiles p
SET    email = u.email
FROM   auth.users u
WHERE  p.id = u.id;

-- ============================================================
-- ÉTAPE 4 — Mettre à jour le trigger pour sauvegarder l'email
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
-- ÉTAPE 5 — Fonction SECURITY DEFINER pour vérifier le statut admin
-- (évite la récursion infinie dans les politiques RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- ============================================================
-- ÉTAPE 6 — Politique RLS : les admins peuvent modifier tous les profils
-- (nécessaire pour promouvoir/rétrograder d'autres utilisateurs)
-- ============================================================

DROP POLICY IF EXISTS "Admins peuvent modifier tous les profils" ON public.profiles;

CREATE POLICY "Admins peuvent modifier tous les profils"
  ON public.profiles FOR UPDATE
  USING (is_admin());

-- ============================================================
-- ÉTAPE 7 — Promouvoir Yannick en admin
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
