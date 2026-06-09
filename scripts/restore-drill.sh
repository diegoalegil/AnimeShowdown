#!/usr/bin/env bash
# ===========================================================================
# restore-drill.sh — Drill de restore: último backup de R2 → Postgres efímero
#
# Contraparte de backup-and-rotate.sh: un backup solo existe si se puede
# restaurar. Este script NO toca producción — solo LEE de R2 y restaura en
# la BBDD desechable que reciba por DRILL_DATABASE_URL (en CI, un service
# container postgres:17 del runner).
#
# Flow:
#   1. Localiza el dump más reciente en daily/ (filenames con fecha ISO →
#      el último lexicográfico es el último cronológico) y comprueba que es
#      fresco: si el más nuevo tiene más de 2 días, el cron de backup lleva
#      días roto y el drill tiene que avisar aunque el restore funcione.
#   2. Lo descarga y lo restaura con pg_restore, solo el schema public: el
#      dump sale de Supabase, que añade schemas de plataforma (auth, storage,
#      extensions...) que no existen en un Postgres vanilla; la app vive
#      entera en public (Flyway incluido).
#   3. Valida el resultado:
#        - flyway_schema_history: cero migraciones fallidas y toda versión
#          aplicada existe como archivo en backend/src/main/resources/db/
#          migration (una versión en prod que el repo no conoce = drift grave).
#        - Datos de verdad, no solo schema: suelos mínimos de filas en las
#          tablas clave (personajes / usuarios / votos / enfrentamientos).
#
# Variables de entorno requeridas:
#   DRILL_DATABASE_URL     postgresql://user:pass@host:5432/db (DESECHABLE:
#                          pg_restore --clean borra lo que haya)
#   R2_ENDPOINT            https://<account-id>.r2.cloudflarestorage.com
#   R2_ACCESS_KEY_ID       (mismos secretos que backup-and-rotate.sh)
#   R2_SECRET_ACCESS_KEY
#   R2_BUCKET              animeshowdown-backups (hardcoded en workflow)
#
# Requiere: aws cli, pg_restore/psql 17, GNU date (ubuntu-latest; no macOS).
# ===========================================================================

set -euo pipefail

# --- Sanity checks: variables presentes -----------------------------------
: "${DRILL_DATABASE_URL:?DRILL_DATABASE_URL requerida}"
: "${R2_ENDPOINT:?R2_ENDPOINT requerida}"
: "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID requerida}"
: "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY requerida}"
: "${R2_BUCKET:?R2_BUCKET requerida}"

# --- Config interna que AWS CLI lee de env ---------------------------------
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
# R2 ignora la region pero AWS CLI la exige.
export AWS_DEFAULT_REGION="auto"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/../backend/src/main/resources/db/migration"
DUMP_LOCAL="restore-drill.dump"
# Edad máxima del dump más reciente. 2 días dan margen a un fallo puntual
# del cron diario sin convertir cada flake en una alerta.
MAX_AGE_DAYS=2

# psql en modo dato: sin alineado, sin cabeceras, falla si el SQL falla.
q() {
    psql "$DRILL_DATABASE_URL" -v ON_ERROR_STOP=1 -At -c "$1"
}

fail() {
    echo "::error::$1"
    exit 1
}

echo "============================================================"
echo "Restore drill AnimeShowdown — $(date -u +%Y-%m-%d) (UTC)"
echo "Bucket: $R2_BUCKET"
echo "============================================================"

# --- 1) Localizar el último dump daily -------------------------------------
echo "→ Buscando el dump más reciente en daily/ ..."
LATEST_KEY="$(aws s3api list-objects-v2 \
    --bucket "$R2_BUCKET" \
    --prefix "daily/" \
    --endpoint-url "$R2_ENDPOINT" \
    --query "sort_by(Contents, &Key)[-1].Key" \
    --output text 2>/dev/null || true)"

if [ -z "$LATEST_KEY" ] || [ "$LATEST_KEY" = "None" ]; then
    fail "daily/ está vacío — no hay ningún backup que restaurar."
fi
echo "✓ Último dump: $LATEST_KEY"

# Frescura: la fecha viene en el filename (animeshowdown-YYYY-MM-DD.dump).
DUMP_DATE="$(basename "$LATEST_KEY" .dump | sed 's/^animeshowdown-//')"
DUMP_EPOCH="$(date -u -d "$DUMP_DATE" +%s)"
NOW_EPOCH="$(date -u +%s)"
AGE_DAYS=$(( (NOW_EPOCH - DUMP_EPOCH) / 86400 ))
if [ "$AGE_DAYS" -gt "$MAX_AGE_DAYS" ]; then
    fail "El dump más reciente ($DUMP_DATE) tiene $AGE_DAYS días — el cron de backup está roto."
fi
echo "✓ Frescura OK ($AGE_DAYS días ≤ $MAX_AGE_DAYS)."

# --- 2) Descargar + restaurar ----------------------------------------------
echo "→ Descargando $LATEST_KEY ..."
aws s3 cp "s3://$R2_BUCKET/$LATEST_KEY" "$DUMP_LOCAL" \
    --endpoint-url "$R2_ENDPOINT" \
    --no-progress
SIZE_HUMAN="$(du -h "$DUMP_LOCAL" | cut -f1)"
echo "✓ Descargado ($SIZE_HUMAN)."

# --clean --if-exists: idempotente sobre la BBDD desechable.
# --no-owner --no-acl: simétrico al dump; los roles de Supabase no existen aquí.
# --schema=public: ver cabecera (schemas de plataforma de Supabase fuera).
# --exit-on-error: un objeto que no restaura = drill en rojo, no un warning.
echo "→ pg_restore (schema public) ..."
pg_restore \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    --schema=public \
    --exit-on-error \
    --dbname="$DRILL_DATABASE_URL" \
    "$DUMP_LOCAL"
echo "✓ Restore completado sin errores."

# --- 3a) Validar flyway_schema_history --------------------------------------
echo "→ Validando flyway_schema_history ..."
FAILED_MIGRATIONS="$(q "SELECT count(*) FROM flyway_schema_history WHERE NOT success")"
if [ "$FAILED_MIGRATIONS" != "0" ]; then
    fail "flyway_schema_history contiene $FAILED_MIGRATIONS migraciones fallidas."
fi

APPLIED_COUNT="$(q "SELECT count(*) FROM flyway_schema_history WHERE version IS NOT NULL AND success")"
if [ "$APPLIED_COUNT" = "0" ]; then
    fail "flyway_schema_history no tiene migraciones versionadas — restore vacío."
fi

# Toda versión aplicada en prod debe existir como archivo en el repo
# (las migraciones son append-only; el repo puede ir por delante de prod
# unos minutos tras un merge, nunca por detrás).
APPLIED_VERSIONS="$(q "SELECT version FROM flyway_schema_history WHERE version IS NOT NULL AND success ORDER BY version::int")"
REPO_VERSIONS="$(ls "$MIGRATIONS_DIR" | sed -nE 's/^V([0-9]+)__.*\.sql$/\1/p' | sort -n)"
MISSING=""
for v in $APPLIED_VERSIONS; do
    if ! grep -qx "$v" <<< "$REPO_VERSIONS"; then
        MISSING="$MISSING V$v"
    fi
done
if [ -n "$MISSING" ]; then
    fail "Versiones aplicadas en el dump que no existen en el repo:$MISSING"
fi
MAX_VERSION="$(tail -1 <<< "$APPLIED_VERSIONS")"
echo "✓ Flyway OK: $APPLIED_COUNT migraciones aplicadas, última V$MAX_VERSION, 0 fallidas."

# --- 3b) Validar que hay DATOS, no solo schema ------------------------------
echo "→ Validando suelos mínimos de filas ..."
check_floor() {
    local table="$1" floor="$2" rows
    rows="$(q "SELECT count(*) FROM ${table}")"
    if [ "$rows" -lt "$floor" ]; then
        fail "Tabla ${table}: $rows filas (< $floor) — el dump no trae los datos esperados."
    fi
    echo "  · ${table}: ${rows} filas (≥ ${floor})"
}
# Suelos deliberadamente conservadores: detectan un dump vacío/troncado sin
# convertir una limpieza legítima de datos en falso positivo.
check_floor "personajes"     100
check_floor "usuarios"       1
check_floor "votos"          1
check_floor "enfrentamientos" 1

TABLE_COUNT="$(q "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'")"
if [ "$TABLE_COUNT" -lt 30 ]; then
    fail "Solo $TABLE_COUNT tablas en public (< 30) — restore incompleto."
fi
echo "✓ Datos OK ($TABLE_COUNT tablas en public)."

# --- 4) Summary para la UI de Actions ---------------------------------------
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    {
        echo "### Restore drill ✓"
        echo ""
        echo "| Check | Resultado |"
        echo "|---|---|"
        echo "| Dump restaurado | \`$LATEST_KEY\` ($SIZE_HUMAN) |"
        echo "| Frescura | $AGE_DAYS días |"
        echo "| Migraciones Flyway | $APPLIED_COUNT aplicadas, última V$MAX_VERSION, 0 fallidas |"
        echo "| Tablas en public | $TABLE_COUNT |"
        echo "| personajes | $(q 'SELECT count(*) FROM personajes') filas |"
        echo "| usuarios | $(q 'SELECT count(*) FROM usuarios') filas |"
        echo "| votos | $(q 'SELECT count(*) FROM votos') filas |"
    } >> "$GITHUB_STEP_SUMMARY"
fi

# --- 5) Cleanup local --------------------------------------------------------
rm -f "$DUMP_LOCAL"

echo "============================================================"
echo "✓ Drill completado: el backup se puede restaurar."
echo "============================================================"
