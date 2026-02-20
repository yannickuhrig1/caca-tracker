-- ============================================================
-- 🔗 Permission d'invitation — Caca-Tracker 3000 Deluxe
-- Colle ce SQL dans : Supabase > SQL Editor > New Query > Run
-- IDEMPOTENT : safe à relancer plusieurs fois
-- ============================================================

-- Ajoute la colonne allow_member_invite sur la table groups
-- true  (défaut) = tous les membres peuvent partager le code
-- false          = seul le créateur peut inviter
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS allow_member_invite boolean DEFAULT true;

-- Politique RLS : seul le créateur peut modifier les paramètres du groupe
DROP POLICY IF EXISTS "Créateur peut modifier son groupe" ON public.groups;
CREATE POLICY "Créateur peut modifier son groupe"
  ON public.groups FOR UPDATE
  USING (auth.uid() = created_by);

-- Vérification
SELECT id, name, created_by, allow_member_invite
FROM public.groups
ORDER BY created_at;
