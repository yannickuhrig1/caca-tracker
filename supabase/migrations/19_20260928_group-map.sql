-- ============================================================
--  19 — Carte du groupe + partage de stats détaillées (v2.22.0)
--
--  Deux choses, liées à la vie sociale d'un groupe :
--
--  1. `profiles.geo_shared` — opt-in explicite pour partager ses positions
--     (lat/lon) avec les membres de ses groupes. Désactivé par défaut : la
--     position exacte est privée, on ne l'expose jamais sans accord.
--
--  2. `profiles.show_detailed_stats` — opt-out du détail des stats (répartition
--     textures/couleurs, records, badges) vues par les copines. Les compteurs
--     globaux (podium, comparatif) restent visibles, comme aujourd'hui.
--
--  Côté positions, l'opt-in est appliqué EN BASE, pas seulement dans le JS :
--  la fonction SECURITY DEFINER `get_group_geo_poops()` est l'unique porte
--  d'accès aux coordonnées des autres membres, et ne renvoie que les lignes
--  des membres ayant activé `geo_shared`, sur une fenêtre temporelle donnée.
--
--  À passer dans une transaction :
--      BEGIN;  \i 19_20260928_group-map.sql   -- vérifier, puis COMMIT;
--  ou, tout fait, depuis le dépôt : scripts/apply-migrations.sh
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS geo_shared          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_detailed_stats boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.geo_shared          IS 'Partager ses positions (lat/lon) avec les membres de ses groupes (opt-in)';
COMMENT ON COLUMN public.profiles.show_detailed_stats IS 'Autoriser les membres de ses groupes à voir ses stats détaillées';

-- Poops géolocalisés des membres d'un groupe ayant activé geo_shared.
-- `since` est un epoch en millisecondes (comme poops.date) : la carte ne
-- remonte que l'activité récente, jamais une trace permanente.
CREATE OR REPLACE FUNCTION public.get_group_geo_poops(gid uuid, since bigint)
RETURNS TABLE (
  id       uuid,
  user_id  uuid,
  username text,
  avatar   text,
  date     bigint,
  texture  text,
  color    text,
  place    text,
  lat      double precision,
  lon      double precision,
  city     text,
  region   text,
  country  text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.id, p.user_id, pr.username, pr.avatar, p.date, p.texture, p.color,
         p.place, p.lat, p.lon, p.city, p.region, p.country
  FROM public.poops p
  JOIN public.profiles pr ON pr.id = p.user_id
  WHERE public.is_group_member(gid)
    AND p.user_id IN (
          SELECT gm.user_id FROM public.group_members gm WHERE gm.group_id = gid
        )
    AND pr.geo_shared = true
    AND p.lat IS NOT NULL
    AND p.lon IS NOT NULL
    AND p.date >= since
  ORDER BY p.date DESC;
$$;

REVOKE ALL ON FUNCTION public.get_group_geo_poops(uuid, bigint) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_group_geo_poops(uuid, bigint) TO authenticated;

-- PostgREST garde en mémoire sa propre image du schéma.
NOTIFY pgrst, 'reload schema';
