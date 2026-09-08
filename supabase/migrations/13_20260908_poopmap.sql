-- ============================================================
--  13 — PoopMap : lieu et position d'un caca
--
--  Ajoute trois colonnes facultatives à `poops` :
--    place  — étiquette de lieu ('maison', 'boulot', … cf. PLACES
--             dans js/poopmap.js), NULL si non renseignée ;
--    lat/lon— coordonnées arrondies à 4 décimales (~11 m), écrites
--             uniquement sur clic explicite du bouton 📍.
--
--  ⚠️ NON APPLIQUÉ en production à ce jour.
--
--  ORDRE DE DÉPLOIEMENT — indifférent. savePoopCloud() / getMyPoops()
--  (js/supabase-client.js) détectent l'absence des colonnes (PGRST204 /
--  42703) et rejouent la requête sans elles : le JS fonctionne AVANT
--  comme APRÈS. Tant que la migration n'est pas passée, lieu et position
--  restent locaux à l'appareil et ne se synchronisent pas.
--
--  Aucune policy à ajouter : ce sont des colonnes de `poops`, déjà
--  couverte par ses policies RLS existantes (une utilisatrice ne lit et
--  n'écrit que ses propres lignes ; le groupe ne voit que ce que le feed
--  expose). Les positions ne sont donc jamais partagées.
--
--  À passer dans une transaction :
--      BEGIN;  \i 13_20260908_poopmap.sql   -- vérifier, puis COMMIT;
-- ============================================================

ALTER TABLE public.poops
  ADD COLUMN IF NOT EXISTS place text,
  ADD COLUMN IF NOT EXISTS lat   double precision,
  ADD COLUMN IF NOT EXISTS lon   double precision;

-- Garde-fous : des coordonnées hors bornes ne peuvent venir que d'un bug.
ALTER TABLE public.poops
  DROP CONSTRAINT IF EXISTS poops_lat_range,
  DROP CONSTRAINT IF EXISTS poops_lon_range;

ALTER TABLE public.poops
  ADD CONSTRAINT poops_lat_range CHECK (lat IS NULL OR (lat >= -90  AND lat <= 90)),
  ADD CONSTRAINT poops_lon_range CHECK (lon IS NULL OR (lon >= -180 AND lon <= 180));

COMMENT ON COLUMN public.poops.place IS 'PoopMap : lieu déclaré (maison, boulot, ecole, resto, copine, transport, nature, ailleurs)';
COMMENT ON COLUMN public.poops.lat   IS 'PoopMap : latitude arrondie à 4 décimales, NULL si non géolocalisé';
COMMENT ON COLUMN public.poops.lon   IS 'PoopMap : longitude arrondie à 4 décimales, NULL si non géolocalisé';

-- Vérification :
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'poops' AND column_name IN ('place','lat','lon');
