-- ============================================================
-- 💬 Réactions sur le feed — Caca-Tracker 3000 Deluxe
-- Colle ce SQL dans : Supabase > SQL Editor > New Query > Run
-- ============================================================

-- Table des réactions
CREATE TABLE IF NOT EXISTS public.reactions (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  poop_id    uuid NOT NULL REFERENCES public.poops(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji      text NOT NULL CHECK (emoji IN ('💩','🔥','👑','🤣','❤️')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(poop_id, user_id)
);

-- RLS
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

-- Voir les réactions des membres du même groupe
CREATE POLICY "Voir réactions du groupe"
  ON public.reactions FOR SELECT USING (
    public.shares_group_with(
      (SELECT user_id FROM public.poops WHERE id = poop_id)
    ) OR auth.uid() = (SELECT user_id FROM public.poops WHERE id = poop_id)
  );

-- Gérer ses propres réactions
CREATE POLICY "Gérer ses propres réactions"
  ON public.reactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- ✅ Table reactions créée
-- ============================================================
