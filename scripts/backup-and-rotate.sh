#!/usr/bin/env bash
# ===========================================================================
# backup-and-rotate.sh — Backup diario Neon → Cloudflare R2 (Plan v2 §2.8)
#
# Flow:
#   1. pg_dump --format=custom de Neon production.
#   2. Sube a R2 con AWS CLI (R2 es S3-compatible, requiere --endpoint-url).
#   3. Si es lunes, también copia el dump a weekly/.
#   4. Si es día 1 del mes, también copia el dump a monthly/.
#   5. Limpia entradas antiguas:
#        daily/   > 7  días
#        weekly/  > 28 días (~4 semanas)
#        monthly/ > 365 días (~12 meses)
#
# Variables de entorno requeridas:
#   NEON_DATABASE_URL      postgresql://user:pass@host/db?sslmode=require
#   R2_ENDPOINT            https://<account-id>.r2.cloudflarestorage.com
#   R2_ACCESS_KEY_ID       (Access Key del API token R2)
#   R2_SECRET_ACCESS_KEY   (Secret del API token R2)
#   R2_BUCKET              animeshowdown-backups  (hardcoded en workflow)
#
# Convenciones:
#   - set -euo pipefail: fallar rápido y propagar el error al workflow.
#   - Filenames con ISO date para orden lexicográfico = orden cronológico.
#   - aws s3 cp --endpoint-url=$R2_ENDPOINT: la única diferencia con S3 real.
# ===========================================================================

set -euo pipefail

# --- Sanity checks: variables presentes -----------------------------------
: "${NEON_DATABASE_URL:?NEON_DATABASE_URL requerida}"
: "${R2_ENDPOINT:?R2_ENDPOINT requerida}"
: "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID requerida}"
: "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY requerida}"
: "${R2_BUCKET:?R2_BUCKET requerida}"

# --- Config interna que AWS CLI lee de env ---------------------------------
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
# R2 ignora la region pero AWS CLI la exige.
export AWS_DEFAULT_REGION="auto"

# --- Fechas y nombres ------------------------------------------------------
TODAY="$(date -u +%Y-%m-%d)"
DOW="$(date -u +%u)"          # 1=lunes ... 7=domingo
DOM="$(date -u +%d)"          # 01..31
ISO_WEEK="$(date -u +%G-W%V)" # 2026-W20 (ISO 8601)
ISO_MONTH="$(date -u +%Y-%m)" # 2026-05

DUMP_FILE="animeshowdown-${TODAY}.dump"
DAILY_KEY="daily/${DUMP_FILE}"
WEEKLY_KEY="weekly/animeshowdown-${ISO_WEEK}.dump"
MONTHLY_KEY="monthly/animeshowdown-${ISO_MONTH}.dump"

echo "============================================================"
echo "Backup AnimeShowdown — $TODAY (UTC)"
echo "Bucket: $R2_BUCKET"
echo "Endpoint: $R2_ENDPOINT"
echo "============================================================"

# --- 1) pg_dump -----------------------------------------------------------
# --format=custom comprime nativo (~85% reducción), permite pg_restore
# selectivo, y es el formato recomendado por la propia doc de Postgres
# para backups. --no-owner / --no-acl evitan que un restore en una BBDD
# nueva falle por roles/usuarios distintos a los de Neon.
echo "→ pg_dump (custom, no-owner, no-acl) ..."
pg_dump \
    --no-owner \
    --no-acl \
    --format=custom \
    --file="$DUMP_FILE" \
    "$NEON_DATABASE_URL"

SIZE_HUMAN="$(du -h "$DUMP_FILE" | cut -f1)"
echo "✓ Dump generado: $DUMP_FILE ($SIZE_HUMAN)"

# --- 2) Subir daily -------------------------------------------------------
echo "→ Subiendo a r2://$R2_BUCKET/$DAILY_KEY ..."
aws s3 cp "$DUMP_FILE" "s3://$R2_BUCKET/$DAILY_KEY" \
    --endpoint-url "$R2_ENDPOINT" \
    --no-progress
echo "✓ Daily subido."

# --- 3) Copia weekly los lunes --------------------------------------------
if [ "$DOW" = "1" ]; then
    echo "→ Es lunes — copiando también a $WEEKLY_KEY ..."
    aws s3 cp "s3://$R2_BUCKET/$DAILY_KEY" "s3://$R2_BUCKET/$WEEKLY_KEY" \
        --endpoint-url "$R2_ENDPOINT" \
        --no-progress
    echo "✓ Weekly copiado."
fi

# --- 4) Copia monthly el día 1 --------------------------------------------
if [ "$DOM" = "01" ]; then
    echo "→ Es día 1 — copiando también a $MONTHLY_KEY ..."
    aws s3 cp "s3://$R2_BUCKET/$DAILY_KEY" "s3://$R2_BUCKET/$MONTHLY_KEY" \
        --endpoint-url "$R2_ENDPOINT" \
        --no-progress
    echo "✓ Monthly copiado."
fi

# --- 5) Retención: borra lo viejo -----------------------------------------
# La política de Plan v2 §2.8:
#   daily/   retiene 7 días
#   weekly/  retiene 28 días (4 semanas)
#   monthly/ retiene 365 días (12 meses)
#
# Iteramos los objetos del prefijo y borramos los más antiguos que el TTL.
# Usamos `date -u -d` (GNU coreutils) que está disponible en ubuntu-latest.
prune_prefix() {
    local prefix="$1"
    local retain_days="$2"
    local cutoff
    cutoff="$(date -u -d "${retain_days} days ago" +%Y-%m-%dT%H:%M:%SZ)"
    echo "→ Limpiando $prefix (> $retain_days días, cutoff $cutoff) ..."

    # `aws s3api list-objects-v2` devuelve LastModified + Key. Filtramos
    # las que tienen LastModified < cutoff y emitimos solo el Key.
    local victims
    victims="$(aws s3api list-objects-v2 \
        --bucket "$R2_BUCKET" \
        --prefix "$prefix" \
        --endpoint-url "$R2_ENDPOINT" \
        --query "Contents[?LastModified<'${cutoff}'].[Key]" \
        --output text 2>/dev/null || true)"

    if [ -z "$victims" ] || [ "$victims" = "None" ]; then
        echo "  · nada que borrar."
        return
    fi

    local count=0
    while IFS= read -r key; do
        [ -z "$key" ] && continue
        aws s3 rm "s3://$R2_BUCKET/$key" \
            --endpoint-url "$R2_ENDPOINT" \
            --no-progress >/dev/null
        echo "  · borrado $key"
        count=$((count + 1))
    done <<< "$victims"
    echo "  · total borrados: $count"
}

prune_prefix "daily/"   7
prune_prefix "weekly/"  28
prune_prefix "monthly/" 365

# --- 6) Cleanup local ------------------------------------------------------
rm -f "$DUMP_FILE"

echo "============================================================"
echo "✓ Backup completado correctamente."
echo "============================================================"
