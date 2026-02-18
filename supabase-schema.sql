-- ============================================================
-- 💩 Caca-Tracker 3000 Deluxe — Supabase Schema
-- Colle ce SQL dans : Supabase > SQL Editor > New Query > Run
-- ============================================================

-- ============================================================
-- ÉTAPE 1 : CRÉER TOUTES LES TABLES EN ORDRE DE DÉPENDANCE
-- (les politiques cross-tables viennent après, quand tout existe)
-- ============================================================

-- 1. PROFILES (étend auth.users)
create table if not exists public.profiles (
  id         uuid references auth.users on delete cascade not null primary key,
  username   text unique not null,
  avatar     text default '💩',
  created_at timestamptz default now()
);

-- 2. GROUPS (dépend de profiles)
create table if not exists public.groups (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  created_by  uuid references public.profiles(id) not null,
  invite_code text unique default upper(substring(md5(random()::text), 1, 8)),
  created_at  timestamptz default now()
);

-- 3. GROUP_MEMBERS (dépend de groups + profiles)
create table if not exists public.group_members (
  group_id  uuid references public.groups(id) on delete cascade not null,
  user_id   uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

-- 4. POOPS (dépend de profiles — la policy group cross-table vient après)
create table if not exists public.poops (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  local_id   text,
  date       bigint not null,
  texture    text not null,
  color      text not null,
  comment    text default '',
  is_retro   boolean default false,
  created_at timestamptz default now()
);

-- 5. CHALLENGES (dépend de groups)
create table if not exists public.challenges (
  id         uuid default gen_random_uuid() primary key,
  group_id   uuid references public.groups(id) on delete cascade not null,
  title      text not null default 'Qui fera le plus de cacas cette semaine ?',
  start_date date not null,
  end_date   date not null,
  created_at timestamptz default now()
);

-- ============================================================
-- ÉTAPE 2 : ACTIVER RLS SUR TOUTES LES TABLES
-- ============================================================

alter table public.profiles      enable row level security;
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
alter table public.poops         enable row level security;
alter table public.challenges    enable row level security;

-- ============================================================
-- ÉTAPE 3 : POLITIQUES RLS
-- (toutes les tables existent maintenant → aucune erreur de dépendance)
-- ============================================================

-- PROFILES
create policy "Profiles visibles par tous"
  on public.profiles for select using (true);

create policy "Créer son propre profil"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Modifier son propre profil"
  on public.profiles for update using (auth.uid() = id);

-- GROUPS (référence group_members → doit venir après sa création)
create policy "Voir groupes dont on est membre"
  on public.groups for select using (
    auth.uid() = created_by or
    exists (select 1 from public.group_members where group_id = id and user_id = auth.uid())
  );

create policy "Lookup par code invitation"
  on public.groups for select using (true);

create policy "Créer un groupe"
  on public.groups for insert with check (auth.uid() = created_by);

create policy "Supprimer son groupe"
  on public.groups for delete using (auth.uid() = created_by);

-- GROUP_MEMBERS (auto-référence via alias pour éviter la récursion infinie)
create policy "Membres visibles par les membres du groupe"
  on public.group_members for select using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id and gm.user_id = auth.uid()
    )
  );

create policy "Rejoindre un groupe"
  on public.group_members for insert with check (auth.uid() = user_id);

create policy "Quitter un groupe"
  on public.group_members for delete using (auth.uid() = user_id);

-- POOPS (la policy group référence group_members → OK car table existe)
create policy "Voir ses propres cacas"
  on public.poops for select using (auth.uid() = user_id);

create policy "Voir cacas des membres du groupe"
  on public.poops for select using (
    exists (
      select 1 from public.group_members gm1
      join public.group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = auth.uid() and gm2.user_id = poops.user_id
    )
  );

create policy "Insérer ses propres cacas"
  on public.poops for insert with check (auth.uid() = user_id);

create policy "Supprimer ses propres cacas"
  on public.poops for delete using (auth.uid() = user_id);

-- CHALLENGES
create policy "Membres voient les défis du groupe"
  on public.challenges for select using (
    exists (select 1 from public.group_members where group_id = challenges.group_id and user_id = auth.uid())
  );

create policy "Créer un défi dans son groupe"
  on public.challenges for insert with check (
    exists (select 1 from public.group_members where group_id = challenges.group_id and user_id = auth.uid())
  );

-- ============================================================
-- ÉTAPE 4 : INDEX pour performances
-- ============================================================

create index if not exists idx_poops_user_date   on public.poops(user_id, date desc);
create index if not exists idx_poops_local_id    on public.poops(local_id);
create index if not exists idx_group_members_gid on public.group_members(group_id);
create index if not exists idx_group_members_uid on public.group_members(user_id);
create index if not exists idx_groups_code       on public.groups(invite_code);

-- ============================================================
-- ÉTAPE 5 : TRIGGER — profil créé automatiquement à l'inscription
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar', '💩')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- ✅ Schéma installé ! Retourne dans l'app et configure les
--    SUPABASE_URL et SUPABASE_ANON_KEY dans js/supabase-client.js
-- ============================================================
