-- ============================================================
-- ⚙️ Gestion avancée des groupes — Caca-Tracker 3000 Deluxe
-- Colle ce SQL dans : Supabase > SQL Editor > New Query > Run
-- Prérequis : supabase-schema.sql + supabase-rls-fix.sql déjà exécutés
-- ============================================================

-- Permet au créateur d'un groupe de retirer n'importe quel membre
-- (la policy "Quitter un groupe" ne couvre que auth.uid() = user_id)
create policy "Créateur peut retirer des membres"
  on public.group_members for delete using (
    auth.uid() = (select created_by from public.groups where id = group_id)
  );

-- ============================================================
-- ✅ Policy ajoutée — le créateur peut maintenant retirer des membres
-- ============================================================
