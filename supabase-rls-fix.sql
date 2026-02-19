-- ============================================================
-- 🔧 FIX RLS — Récursion infinie dans group_members
-- Colle ce SQL dans : Supabase > SQL Editor > New Query > Run
-- ============================================================
-- PROBLÈME : la policy SELECT de group_members se référençait
-- elle-même, créant une boucle infinie à chaque requête.
-- SOLUTION : fonctions SECURITY DEFINER qui bypassent RLS.
-- ============================================================

-- 1. HELPER : vérifier si l'utilisateur courant est membre d'un groupe
--    SECURITY DEFINER = bypass RLS → pas de récursion
create or replace function public.is_group_member(gid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

-- 2. HELPER : vérifier si deux users partagent un groupe commun
create or replace function public.shares_group_with(other_user_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.group_members gm1
    join public.group_members gm2 on gm1.group_id = gm2.group_id
    where gm1.user_id = auth.uid() and gm2.user_id = other_user_id
  );
$$;

-- 3. RECRÉER les policies problématiques avec les helpers

-- group_members : remplacer la policy auto-référentielle
drop policy if exists "Membres visibles par les membres du groupe" on public.group_members;
create policy "Membres visibles par les membres du groupe"
  on public.group_members for select using (
    public.is_group_member(group_members.group_id)
  );

-- groups : remplacer la policy qui référençait group_members directement
drop policy if exists "Voir groupes dont on est membre" on public.groups;
create policy "Voir groupes dont on est membre"
  on public.groups for select using (
    auth.uid() = created_by or public.is_group_member(id)
  );

-- poops : remplacer la double jointure sur group_members
drop policy if exists "Voir cacas des membres du groupe" on public.poops;
create policy "Voir cacas des membres du groupe"
  on public.poops for select using (
    public.shares_group_with(poops.user_id)
  );

-- challenges : remplacer la policy qui référençait group_members directement
drop policy if exists "Membres voient les défis du groupe" on public.challenges;
create policy "Membres voient les défis du groupe"
  on public.challenges for select using (
    public.is_group_member(challenges.group_id)
  );

drop policy if exists "Créer un défi dans son groupe" on public.challenges;
create policy "Créer un défi dans son groupe"
  on public.challenges for insert with check (
    public.is_group_member(challenges.group_id)
  );

-- ============================================================
-- ✅ Politiques RLS mises à jour — groupes et feed fonctionnels
-- ============================================================
