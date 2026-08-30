-- ============================================================
-- 🔧 FIX — Policies manquantes sur la table groups
-- Colle ce SQL dans : Supabase > SQL Editor > New Query > Run
-- ============================================================
-- S'assure que les 4 policies de groups existent bien.
-- La policy "Lookup par code invitation" est critique : sans elle,
-- un nouvel utilisateur ne peut pas trouver un groupe par son code.
-- ============================================================

-- SELECT : tout le monde peut chercher un groupe par code d'invitation
drop policy if exists "Lookup par code invitation" on public.groups;
create policy "Lookup par code invitation"
  on public.groups for select using (true);

-- SELECT : voir ses propres groupes (helper anti-récursion)
drop policy if exists "Voir groupes dont on est membre" on public.groups;
create policy "Voir groupes dont on est membre"
  on public.groups for select using (
    auth.uid() = created_by or public.is_group_member(id)
  );

-- INSERT : créer un groupe (en tant que créateur)
drop policy if exists "Créer un groupe" on public.groups;
create policy "Créer un groupe"
  on public.groups for insert with check (auth.uid() = created_by);

-- DELETE : supprimer son propre groupe
drop policy if exists "Supprimer son groupe" on public.groups;
create policy "Supprimer son groupe"
  on public.groups for delete using (auth.uid() = created_by);

-- ============================================================
-- ✅ Vérification — policies actives sur groups
-- ============================================================
select policyname, cmd, qual, with_check
from   pg_policies
where  tablename = 'groups';
