#!/usr/bin/env bash
#
# Applique les migrations PoopMap (13 et 14) sur la base du NAS.
#
# À lancer DEPUIS LE NAS, dans une copie du dépôt :
#     ./scripts/apply-migrations.sh
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
     AND column_name IN ('place','lat','lon','city','region','country','country_code')
   ORDER BY column_name;"

# Ceinture et bretelles : les migrations envoient déjà ce signal, mais si
# PostgREST n'écoute pas le canal (db-channel-enabled à false), il faut le
# redémarrer pour qu'il relise le schéma.
echo
echo "🔄 Rechargement du cache de schéma PostgREST…"
psql_exec -c "NOTIFY pgrst, 'reload schema';"
echo "   Si l'app répond encore « colonne inconnue » d'ici une minute,"
echo "   redémarre le conteneur PostgREST (docker restart caca-rest)."
echo
echo "🎉 Terminé. Lieux, positions et territoires se synchronisent maintenant"
echo "   entre les appareils. Sur le téléphone : se déconnecter / reconnecter"
echo "   pour repousser l'historique local vers le cloud."
