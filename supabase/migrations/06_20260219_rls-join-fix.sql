-- ============================================================
-- 🔧 FIX — Rejoindre un groupe (RLS group_members)
-- Erreur : "new row violates row-level security policy for
--           table group_members"
--
-- Colle ce SQL dans : Supabase > SQL Editor > New Query > Run
-- ============================================================
-- Ce fichier recrée TOUTES les policies de group_members
-- proprement, en supprimant d'abord les anciennes.
-- ============================================================

-- SELECT : membres visibles entre membres (helpers anti-récursion)
drop policy if exists "Membres visibles par les membres du groupe" on public.group_members;
create policy "Membres visibles par les membres du groupe"
  on public.group_members for select using (
    public.is_group_member(group_members.group_id)
  );

-- INSERT : n'importe quel utilisateur authentifié peut rejoindre
--          un groupe en tant que lui-même
drop policy if exists "Rejoindre un groupe" on public.group_members;
create policy "Rejoindre un groupe"
  on public.group_members for insert
  with check (auth.uid() = user_id);

-- DELETE : quitter son propre groupe
drop policy if exists "Quitter un groupe" on public.group_members;
create policy "Quitter un groupe"
  on public.group_members for delete using (
    auth.uid() = user_id
  );

-- DELETE : le créateur du groupe peut retirer n'importe quel membre
drop policy if exists "Créateur peut retirer des membres" on public.group_members;
create policy "Créateur peut retirer des membres"
  on public.group_members for delete using (
    auth.uid() = (select created_by from public.groups where id = group_id)
  );

-- ============================================================
-- ✅ Vérification — liste les policies actives sur group_members
-- ============================================================
select policyname, cmd, qual, with_check
from   pg_policies
where  tablename = 'group_members';
