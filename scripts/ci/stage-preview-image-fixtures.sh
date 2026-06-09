#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../.." && pwd)"
frontend_dir="${repo_root}/frontend"
dist_dir="${1:-${frontend_dir}/dist}"

fixtures=(
  "One_Piece/luffy.webp"
  "One_Piece/zoro.webp"
  "Naruto/naruto.webp"
)

for fixture in "${fixtures[@]}"; do
  source_file="${frontend_dir}/img/${fixture}"
  target_file="${dist_dir}/img/${fixture}"

  if [ ! -f "$source_file" ]; then
    echo "::error::Missing preview image fixture: ${source_file}"
    exit 1
  fi

  mkdir -p "$(dirname "$target_file")"
  cp "$source_file" "$target_file"
done

echo "OK: staged ${#fixtures[@]} preview image fixture(s) into ${dist_dir}/img."
