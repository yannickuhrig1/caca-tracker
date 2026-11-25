-- ============================================================
--  00 — Baseline des tables v2.10 / v2.11 créées hors dépôt
--
--  Reconstitue de façon STRICTEMENT IDEMPOTENTE les 6 tables créées
--  directement en production lors des versions v2.10.0 et v2.11.0
--  (juillet 2026), absentes des migrations historiques 01 → 11 :
--
--    1. public.comments            (5 col.) — commentaires sous un caca
--    2. public.nudges              (6 col.) — relances entre membres
--    3. public.feed_events         (7 col.) — badges et stats partagés au feed
--    4. public.challenge_wins      (8 col.) — palmarès hebdo (Hall of Fame)
--    5. public.push_subscriptions  (6 col.) — abonnements Web Push (VAPID)
--    6. public.push_reminder_state (2 col.) — anti-spam du rappel push 24 h
--
--  Sources de vérité :
--    - supabase/SCHEMA.md (introspection OpenAPI PostgREST de production)
--    - supabase/SECURITE-RLS.md (aucune lecture/écriture pour le rôle `anon`)
--    - js/supabase-client.js, js/push.js, js/social.js
--
--  ORDRE D'EXÉCUTION SUR UNE BASE VIERGE :
--    1. Jouer `01_20260218_schema.sql` → `10_20260221_updated-at.sql`
--       (ignorer `11_20260221_secrets.sql`, table `app_secrets` obsolète).
--    2. Jouer ce fichier `00_baseline_missing_tables.sql`.
--    3. Jouer `12_rls-durcissement.sql` → `19_20260928_group-map.sql`.
--
--  Sur une base existante (NAS de production), ce script est sans effet
--  destructif : `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
--  `ENABLE ROW LEVEL SECURITY` et policies protégées contre `duplicate_object`.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Garde-fous : fonctions SECURITY DEFINER requises par les policies
--    (créées seulement si absentes, par ex. si joué juste après la 01)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.is_group_member(uuid)') IS NULL THEN
    CREATE FUNCTION public.is_group_member(gid uuid)
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    STABLE
    SET search_path = public
    AS $fn$
      SELECT EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = gid AND user_id = auth.uid()
      );
    $fn$;
  END IF;

  IF to_regprocedure('public.shares_group_with(uuid)') IS NULL THEN
    CREATE FUNCTION public.shares_group_with(other_user_id uuid)
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    STABLE
    SET search_path = public
    AS $fn$
      SELECT EXISTS (
        SELECT 1 FROM public.group_members gm1
        JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
        WHERE gm1.user_id = auth.uid() AND gm2.user_id = other_user_id
      );
    $fn$;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 1. public.comments (5 colonnes — v2.11.0)
--    Commentaires / chambrage sous un caca du feed social.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comments (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  poop_id    uuid        NOT NULL REFERENCES public.poops(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 280),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comments_poop_created_idx
  ON public.comments (poop_id, created_at ASC);
CREATE INDEX IF NOT EXISTS comments_user_idx
  ON public.comments (user_id);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.comments FROM anon;
GRANT SELECT, INSERT, DELETE ON public.comments TO authenticated;

DO $$
BEGIN
  CREATE POLICY "comments_select_group"
    ON public.comments FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.poops p
        WHERE p.id = comments.poop_id
          AND (p.user_id = auth.uid() OR public.shares_group_with(p.user_id))
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "comments_insert_group"
    ON public.comments FOR INSERT
    TO authenticated
    WITH CHECK (
      auth.uid() = user_id
      AND EXISTS (
        SELECT 1 FROM public.poops p
        WHERE p.id = comments.poop_id
          AND (p.user_id = auth.uid() OR public.shares_group_with(p.user_id))
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "comments_delete_own"
    ON public.comments FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------
-- 2. public.nudges (6 colonnes — v2.11.0)
--    Relances amicales (« 👉 Relancer ») entre membres d'un groupe.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nudges (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id   uuid        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  emoji      text        NOT NULL DEFAULT '💩',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nudges_to_user_created_idx
  ON public.nudges (to_user, created_at DESC);
CREATE INDEX IF NOT EXISTS nudges_group_created_idx
  ON public.nudges (group_id, created_at DESC);

ALTER TABLE public.nudges ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.nudges FROM anon;
GRANT SELECT, INSERT ON public.nudges TO authenticated;

DO $$
BEGIN
  CREATE POLICY "nudges_select_group"
    ON public.nudges FOR SELECT
    TO authenticated
    USING (
      auth.uid() = from_user
      OR auth.uid() = to_user
      OR public.is_group_member(group_id)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "nudges_insert_group"
    ON public.nudges FOR INSERT
    TO authenticated
    WITH CHECK (
      auth.uid() = from_user
      AND public.is_group_member(group_id)
      AND public.shares_group_with(to_user)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------
-- 3. public.feed_events (7 colonnes — v2.11.0 / v2.22.0)
--    Événements publiés au feed : badges débloqués (`badge`, `badge_rare`)
--    et partages mensuels de statistiques (`stats_share`).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feed_events (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text        NOT NULL,
  ref        text        NOT NULL,
  title      text        NOT NULL,
  emoji      text        NOT NULL DEFAULT '🏆',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, type, ref)
);

CREATE INDEX IF NOT EXISTS feed_events_user_created_idx
  ON public.feed_events (user_id, created_at DESC);

ALTER TABLE public.feed_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.feed_events FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_events TO authenticated;

DO $$
BEGIN
  CREATE POLICY "feed_events_select_group"
    ON public.feed_events FOR SELECT
    TO authenticated
    USING (
      auth.uid() = user_id
      OR public.shares_group_with(user_id)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "feed_events_insert_own"
    ON public.feed_events FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "feed_events_update_own"
    ON public.feed_events FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "feed_events_delete_own"
    ON public.feed_events FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------
-- 4. public.challenge_wins (8 colonnes — v2.11.0)
--    Palmarès Hall of Fame des défis hebdomadaires (calculé par `caca-push`).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.challenge_wins (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id       uuid        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start     date        NOT NULL,
  challenge_type text        NOT NULL DEFAULT 'count',
  title          text,
  score          integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, week_start)
);

CREATE INDEX IF NOT EXISTS challenge_wins_group_week_idx
  ON public.challenge_wins (group_id, week_start DESC);
CREATE INDEX IF NOT EXISTS challenge_wins_user_idx
  ON public.challenge_wins (user_id);

ALTER TABLE public.challenge_wins ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.challenge_wins FROM anon;
GRANT SELECT ON public.challenge_wins TO authenticated;

DO $$
BEGIN
  CREATE POLICY "challenge_wins_select_group"
    ON public.challenge_wins FOR SELECT
    TO authenticated
    USING (public.is_group_member(group_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------
-- 5. public.push_subscriptions (6 colonnes — v2.10.0)
--    Abonnements Web Push VAPID par appareil (`endpoint` unique).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   text        NOT NULL UNIQUE,
  p256dh     text        NOT NULL,
  auth       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.push_subscriptions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

DO $$
BEGIN
  CREATE POLICY "push_subscriptions_select_own"
    ON public.push_subscriptions FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "push_subscriptions_insert_own"
    ON public.push_subscriptions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "push_subscriptions_update_own"
    ON public.push_subscriptions FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "push_subscriptions_delete_own"
    ON public.push_subscriptions FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------
-- 6. public.push_reminder_state (2 colonnes — v2.10.0)
--    Anti-spam du rappel d'inactivité 24 h (écrit par le worker `caca-push`).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_reminder_state (
  user_id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_reminder_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_reminder_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.push_reminder_state FROM anon;
GRANT SELECT ON public.push_reminder_state TO authenticated;

DO $$
BEGIN
  CREATE POLICY "push_reminder_state_select_own"
    ON public.push_reminder_state FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------
-- 7. Publication Realtime (idempotent, tolère l'absence de privilège owner)
--    js/social.js écoute `comments`, `feed_events` et `nudges` en temps réel.
-- ------------------------------------------------------------
DO $$
DECLARE
  tbl text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH tbl IN ARRAY ARRAY['comments', 'nudges', 'feed_events'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = tbl
      ) THEN
        BEGIN
          EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
        EXCEPTION
          WHEN duplicate_object OR insufficient_privilege THEN NULL;
        END;
      END IF;
    END LOOP;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
