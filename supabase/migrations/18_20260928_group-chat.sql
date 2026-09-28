-- ============================================================
--  18 — Chat de groupe (v2.22.0)
--
--  Ajoute `group_messages` : un fil de discussion temps réel par groupe.
--  Chaque membre du groupe lit tous les messages, en envoie, et ne peut
--  supprimer que les siens.
--
--  RLS : tout passe par is_group_member() (SECURITY DEFINER) — jamais de
--  `USING (true)` (cf. audit RLS de `supabase/SECURITE-RLS.md`).
--
--  Realtime : la table est ajoutée à la publication `supabase_realtime` de
--  façon idempotente, pour que le fil soit poussé en direct (conteneur
--  `caca-realtime` du NAS).
--
--  À passer dans une transaction :
--      BEGIN;  \i 18_20260928_group-chat.sql   -- vérifier, puis COMMIT;
--  ou, tout fait, depuis le dépôt : scripts/apply-migrations.sh
-- ============================================================

CREATE TABLE IF NOT EXISTS public.group_messages (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id   uuid        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at timestamptz DEFAULT now()
);

-- Le fil est relu du plus récent au plus ancien : l'index évite un tri complet.
CREATE INDEX IF NOT EXISTS group_messages_group_created_idx
  ON public.group_messages (group_id, created_at DESC);

ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Voir les messages de son groupe"        ON public.group_messages;
DROP POLICY IF EXISTS "Envoyer un message dans son groupe"     ON public.group_messages;
DROP POLICY IF EXISTS "Supprimer ses propres messages"         ON public.group_messages;

CREATE POLICY "Voir les messages de son groupe"
  ON public.group_messages FOR SELECT
  USING (public.is_group_member(group_id));

CREATE POLICY "Envoyer un message dans son groupe"
  ON public.group_messages FOR INSERT
  WITH CHECK (public.is_group_member(group_id) AND auth.uid() = user_id);

CREATE POLICY "Supprimer ses propres messages"
  ON public.group_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Expose la table au flux temps réel (idempotent : rejouable sans erreur).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'group_messages'
     )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
  END IF;
END $$;

-- PostgREST garde en mémoire sa propre image du schéma.
NOTIFY pgrst, 'reload schema';
