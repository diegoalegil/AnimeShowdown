#!/usr/bin/env bash
set -euo pipefail

url="${1:?usage: wait-for-http.sh <url> <timeout-seconds> <interval-seconds> [log-file]}"
timeout_seconds="${2:-120}"
interval_seconds="${3:-2}"
log_file="${4:-}"

if ! [[ "$timeout_seconds" =~ ^[0-9]+$ ]] || [ "$timeout_seconds" -le 0 ]; then
  echo "::error::timeout-seconds must be a positive integer"
  exit 2
fi

if ! [[ "$interval_seconds" =~ ^[0-9]+$ ]] || [ "$interval_seconds" -le 0 ]; then
  echo "::error::interval-seconds must be a positive integer"
  exit 2
fi

deadline=$((SECONDS + timeout_seconds))
attempt=0

until curl -fsS "$url" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "::error::Timed out waiting ${timeout_seconds}s for ${url}"
    if [ -n "$log_file" ] && [ -f "$log_file" ]; then
      echo "Last 200 lines from ${log_file}:"
      tail -200 "$log_file"
    fi
    exit 1
  fi
  sleep "$interval_seconds"
done

elapsed=$((timeout_seconds - (deadline - SECONDS)))
echo "OK: ${url} responded after ${elapsed}s (${attempt} failed attempt(s))."
