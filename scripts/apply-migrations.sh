#!/usr/bin/env bash
#
# Applique les migrations 13, 14 (PoopMap), 15 (durée, santé, ligue), 16
# (Jeux du trône), 17 (Le Grand Transit), 18 (chat de groupe) et 19 (carte du
# groupe + partage de stats détaillées) sur la base du NAS.
#
# À lancer DEPUIS LE NAS, dans le clone du dépôt :
#     cd /mnt/user/appdata/compose-stacks/caca-supabase/caca-tracker
#     git pull && ./scripts/apply-migrations.sh
#
# ⚠️  Ne pas confondre avec le dossier repo-migrations/ voisin : c'est un
#     instantané figé (migrations 13 → 16) avec sa propre copie de ce script.
#     Il s'exécute sans erreur tout en sautant les migrations plus récentes.
#
# ⚠️  Migration 18, premier passage : `ALTER PUBLICATION supabase_realtime ADD
#     TABLE` exige d'être propriétaire de la publication, or ici elle appartient
#     à supabase_admin et « postgres » n'en est pas membre. Le tout premier
#     passage de la 18 se fait donc avec supabase_admin, suivi de
#     « ALTER TABLE public.group_messages OWNER TO postgres; » pour rester
#     cohérent avec le reste du schéma. Ensuite la table est déjà dans la
#     publication : le bloc DO est sauté et ce script rejoue la 18 sans souci.
#
# Chaque fichier passe dans une transaction : en cas d'erreur, rien n'est
# appliqué. Les migrations sont idempotentes (ADD COLUMN IF NOT EXISTS), les
# relancer ne casse donc rien et ne touche à aucune donnée existante.
#
# Réglages, si la stack ne s'appelle pas comme prévu :
#     CONTENEUR=autre-nom ./scripts/apply-migrations.sh
#
set -euo pipefail

CONTENEUR="${CONTENEUR:-caca-db}"
UTILISATEUR="${UTILISATEUR:-postgres}"
BASE="${BASE:-postgres}"

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS=(
  "supabase/migrations/13_20260908_poopmap.sql"
  "supabase/migrations/14_20260908_poopmap-conquete.sql"
  "supabase/migrations/15_20260917_duree-sante-ligue.sql"
  "supabase/migrations/16_20260917_jeux-du-trone.sql"
  "supabase/migrations/17_20260918_grand-transit.sql"
  "supabase/migrations/18_20260928_group-chat.sql"
  "supabase/migrations/19_20260928_group-map.sql"
)

psql_exec() {
  # --single-transaction + ON_ERROR_STOP : tout ou rien.
  docker exec -i "$CONTENEUR" psql -U "$UTILISATEUR" -d "$BASE" \
    -v ON_ERROR_STOP=1 --single-transaction -q "$@"
}

if ! docker inspect "$CONTENEUR" >/dev/null 2>&1; then
  echo "❌ Conteneur « $CONTENEUR » introuvable."
  echo "   Vérifie son nom avec « docker ps », puis relance :"
  echo "   CONTENEUR=le-bon-nom $0"
  exit 1
fi

for migration in "${MIGRATIONS[@]}"; do
  echo "▶️  $migration"
  psql_exec < "$RACINE/$migration"
  echo "✅ appliquée"
done

echo
echo "🔍 Colonnes présentes sur public.poops :"
psql_exec -c "
  SELECT column_name, data_type
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'poops'
     AND column_name IN ('place','lat','lon','city','region','country','country_code','duration_s')
   ORDER BY column_name;"

echo
echo "🔍 Colonnes de partage ajoutées sur public.profiles :"
psql_exec -c "
  SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'profiles'
     AND column_name IN ('geo_shared','show_detailed_stats')
   ORDER BY column_name;"

echo
echo "🔍 Carnet de santé et ligue :"
psql_exec -c "
  SELECT 'poop_health' AS objet, count(*) AS policies FROM pg_policies WHERE tablename = 'poop_health'
  UNION ALL
  SELECT 'group_league()', count(*) FROM pg_proc WHERE proname = 'group_league'
  UNION ALL
  SELECT 'game_scores', count(*) FROM pg_policies WHERE tablename = 'game_scores';"

echo
echo "🔍 Chat de groupe et carte du groupe :"
psql_exec -c "
  SELECT 'group_messages (policies, attendu 3)' AS objet,
         count(*)::text AS valeur
    FROM pg_policies WHERE tablename = 'group_messages'
  UNION ALL
  SELECT 'group_messages (RLS activée)',
         coalesce((SELECT relrowsecurity::text FROM pg_class
                    WHERE oid = to_regclass('public.group_messages')), 'table absente')
  UNION ALL
  SELECT 'group_messages (publication realtime)',
         count(*)::text
    FROM pg_publication_tables
   WHERE pubname = 'supabase_realtime'
     AND schemaname = 'public' AND tablename = 'group_messages'
  UNION ALL
  SELECT 'get_group_geo_poops() (attendu 1)',
         count(*)::text FROM pg_proc WHERE proname = 'get_group_geo_poops';"

# Ceinture et bretelles : les migrations envoient déjà ce signal, mais si
# PostgREST n'écoute pas le canal (db-channel-enabled à false), il faut le
# redémarrer pour qu'il relise le schéma.
echo
echo "🔄 Rechargement du cache de schéma PostgREST…"
psql_exec -c "NOTIFY pgrst, 'reload schema';"
echo "   Si l'app répond encore « colonne inconnue » d'ici une minute,"
echo "   redémarre le conteneur PostgREST (docker restart caca-rest)."
echo
echo "🎉 Terminé. Lieux, positions, durées, carnet de santé, chat de groupe et"
echo "   carte des copines se synchronisent maintenant entre les appareils. Au"
echo "   lancement suivant, l'app repousse d'elle-même les durées et symptômes"
echo "   saisis avant la migration."
