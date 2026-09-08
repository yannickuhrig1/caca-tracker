-- ============================================================
--  14 — PoopMap : conquête (commune, région, pays)
--
--  Complète la migration 13. Quatre colonnes facultatives de plus sur
--  `poops`, remplies par le géocodage inverse Nominatim quand l'utilisatrice
--  active « Retrouver commune et pays » (réglage distinct de la position) :
--    city / region / country — libellés en clair, tels que rendus par
--                              OpenStreetMap en français ;
--    country_code            — code ISO 2 lettres, sert au drapeau 🇫🇷.
--
--  ⚠️ NON APPLIQUÉE en production à ce jour, pas plus que la 13.
--
--  ORDRE DE DÉPLOIEMENT — indifférent, même mécanique qu'en 13 :
--  savePoopCloud() / getMyPoops() détectent les colonnes manquantes
--  (PGRST204 / 42703) et rejouent la requête sans elles. Tant que rien
--  n'est appliqué, lieu, position et conquête restent locaux à l'appareil.
--
--  Aucune policy à ajouter : colonnes de `poops`, déjà couverte par ses
--  policies RLS. Les territoires ne sont pas partagés avec le groupe.
--
--  À passer dans une transaction, après la 13 :
--      BEGIN;  \i 14_20260908_poopmap-conquete.sql   -- vérifier, puis COMMIT;
-- ============================================================

ALTER TABLE public.poops
  ADD COLUMN IF NOT EXISTS city         text,
  ADD COLUMN IF NOT EXISTS region       text,
  ADD COLUMN IF NOT EXISTS country      text,
  ADD COLUMN IF NOT EXISTS country_code text;

-- Le code pays vient d'une API tierce : on refuse tout ce qui n'est pas ISO-2.
ALTER TABLE public.poops
  DROP CONSTRAINT IF EXISTS poops_country_code_iso2;

ALTER TABLE public.poops
  ADD CONSTRAINT poops_country_code_iso2
  CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');

COMMENT ON COLUMN public.poops.city         IS 'PoopMap : commune déduite de lat/lon (Nominatim), NULL si non résolue';
COMMENT ON COLUMN public.poops.region       IS 'PoopMap : région / département déduit de lat/lon';
COMMENT ON COLUMN public.poops.country      IS 'PoopMap : pays déduit de lat/lon, libellé en français';
COMMENT ON COLUMN public.poops.country_code IS 'PoopMap : code ISO 3166-1 alpha-2 en majuscules (FR, BE…)';

-- Vérification :
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'poops' AND column_name IN ('city','region','country','country_code');
