-- ============================================================
-- 🔑 app_secrets — stockage sécurisé des clés sensibles
-- Coller dans Supabase > SQL Editor et exécuter
-- ============================================================

-- 1. Créer la table
create table if not exists app_secrets (
  key   text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- 2. Activer RLS
alter table app_secrets enable row level security;

-- 3. Seuls les admins peuvent lire
create policy "admins_read_secrets" on app_secrets
  for select using (
    exists (
      select 1 from profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- 4. Seuls les admins peuvent écrire / mettre à jour
create policy "admins_write_secrets" on app_secrets
  for all using (
    exists (
      select 1 from profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- 5. Insérer la service role key (la remplacer par la vraie valeur)
--    Supabase > Settings > API > service_role (secret)
insert into app_secrets (key, value)
values ('service_role_key', 'COLLE_TA_SERVICE_ROLE_KEY_ICI')
on conflict (key) do update set value = excluded.value, updated_at = now();
