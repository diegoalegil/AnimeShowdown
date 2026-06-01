#!/usr/bin/env bash
# Falla si un cambio modifica/borra una migracion Flyway que ya existia en la
# rama base. Las migraciones aplicadas son historicas: si hace falta corregir
# schema, se anade una V{n+1} nueva.

set -euo pipefail

BASE_REF="${1:-}"
HEAD_REF="${2:-HEAD}"
MIGRATIONS_DIR="backend/src/main/resources/db/migration"
ALLOWED_EXISTING_GAPS="43"

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if [ -z "$BASE_REF" ]; then
  echo "Uso: $0 <base-ref> [head-ref]" >&2
  exit 2
fi

if ! git cat-file -e "$BASE_REF^{commit}" 2>/dev/null; then
  echo "Base ref no disponible ($BASE_REF); se omite guardrail Flyway."
  exit 0
fi

version_from_path() {
  basename "$1" | sed -nE 's/^V([0-9]+)__.*/\1/p'
}

is_allowed_existing_gap() {
  local candidate="$1"
  for allowed in $ALLOWED_EXISTING_GAPS; do
    if [ "$candidate" = "$allowed" ]; then
      return 0
    fi
  done
  return 1
}

base_max=0
base_versions="$(mktemp)"
trap 'rm -f "$base_versions"' EXIT
while IFS= read -r path; do
  version="$(version_from_path "$path")"
  if [ -n "$version" ] && [ "$version" -gt "$base_max" ]; then
    base_max="$version"
  fi
  if [ -n "$version" ]; then
    printf '%s\n' "$version" >> "$base_versions"
  fi
done < <(git ls-tree -r --name-only "$BASE_REF" -- "$MIGRATIONS_DIR"/V*__*.sql)

base_gap_violations=()
if [ "$base_max" -gt 0 ]; then
  for expected in $(seq 1 "$base_max"); do
    if ! grep -qx "$expected" "$base_versions" && ! is_allowed_existing_gap "$expected"; then
      base_gap_violations+=("V$expected")
    fi
  done
fi

if [ "${#base_gap_violations[@]}" -gt 0 ]; then
  echo "ERROR: unexpected Flyway version gaps in base history." >&2
  echo "Only V43 is intentionally reserved and must remain unused." >&2
  printf ' - %s\n' "${base_gap_violations[@]}" >&2
  exit 1
fi

violations=()
while IFS=$'\t' read -r status path rest; do
  [ -z "${status:-}" ] && continue
  version="$(version_from_path "$path")"
  [ -z "$version" ] && continue

  case "$status" in
    A)
      if [ "$version" -le "$base_max" ]; then
        violations+=("$status $path (version <= V$base_max ya existente en base)")
      fi
      ;;
    *)
      violations+=("$status $path (no modificar/borrar migraciones ya versionadas)")
      ;;
  esac
done < <(git diff --name-status "$BASE_REF" "$HEAD_REF" -- "$MIGRATIONS_DIR"/V*__*.sql)

if [ "${#violations[@]}" -gt 0 ]; then
  echo "ERROR: Flyway migrations are immutable once merged/applied." >&2
  echo "Create a new migration instead of editing history." >&2
  printf ' - %s\n' "${violations[@]}" >&2
  exit 1
fi

echo "Flyway guardrail OK: no applied migration was modified."
