-- ============================================================
-- 🕐 updated_at sur la table poops — Caca-Tracker 3000 Deluxe
-- Colle ce SQL dans : Supabase > SQL Editor > New Query > Run
-- IDEMPOTENT : safe à relancer plusieurs fois
-- ============================================================

-- Ajoute la colonne updated_at (bigint = timestamp ms côté JS)
ALTER TABLE public.poops
  ADD COLUMN IF NOT EXISTS updated_at bigint DEFAULT 0;

-- Initialise les lignes existantes avec la date d'enregistrement si besoin
UPDATE public.poops SET updated_at = EXTRACT(EPOCH FROM now()) * 1000
WHERE updated_at IS NULL OR updated_at = 0;

-- Vérification
SELECT id, local_id, date, updated_at
FROM public.poops
ORDER BY updated_at DESC
LIMIT 10;
