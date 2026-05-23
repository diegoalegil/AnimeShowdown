#!/usr/bin/env bash
# smoke-test.sh — verifica los caminos críticos en <30s tras cada deploy.
# Uso: bash scripts/smoke-test.sh [api_url] [web_url]
# Por defecto apunta a producción (Railway + Cloudflare Pages).

set -euo pipefail

API="${1:-${API:-https://api.animeshowdown.dev}}"
WEB="${2:-${WEB:-https://animeshowdown.dev}}"
EXPECTED_PERSONAJES="${EXPECTED_PERSONAJES:-1052}"

green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
blue()  { printf "\033[34m▶ %s\033[0m\n" "$1"; }

# Comprueba que jq está instalado
if ! command -v jq >/dev/null 2>&1; then
  red "❌ jq no está instalado. brew install jq (macOS) o apt install jq (Linux)."
  exit 2
fi

blue "Apuntando a:"
echo "    API: $API"
echo "    WEB: $WEB"
echo "    Esperando >= $EXPECTED_PERSONAJES personajes en BBDD"
echo ""

blue "1/8 Health backend"
curl -fsS "$API/actuator/health" | jq -e '.status == "UP"' >/dev/null
green "    ✓ /actuator/health → UP"

blue "2/8 Personajes en BBDD (>=$EXPECTED_PERSONAJES)"
COUNT=$(curl -fsS "$API/api/personajes" | jq length)
if [ "$COUNT" -lt "$EXPECTED_PERSONAJES" ]; then
  red "    ❌ Esperaba >= $EXPECTED_PERSONAJES personajes, recibí $COUNT"
  red "       Si BBDD está vacía: el siguiente Railway redeploy debería poblarla (DataSeeder idempotente)"
  exit 1
fi
green "    ✓ /api/personajes → $COUNT personajes"

blue "3/8 Filtro por anime"
NARUTO_COUNT=$(curl -fsS "$API/api/personajes?anime=Naruto" | jq length)
if [ "$NARUTO_COUNT" -lt 1 ]; then
  red "    ❌ Filtro ?anime=Naruto devolvió 0 (esperado >0)"
  exit 1
fi
green "    ✓ /api/personajes?anime=Naruto → $NARUTO_COUNT personajes"

blue "4/8 Ranking público"
curl -fsS "$API/api/votos/ranking" | jq -e 'type == "array"' >/dev/null
green "    ✓ /api/votos/ranking → array"

blue "5/8 Swagger UI carga"
SWAGGER_CODE=$(curl -fsS -o /dev/null -w "%{http_code}" "$API/swagger-ui/index.html")
if [ "$SWAGGER_CODE" != "200" ]; then
  red "    ❌ Swagger UI devolvió $SWAGGER_CODE (esperado 200)"
  exit 1
fi
green "    ✓ /swagger-ui/index.html → 200"

blue "6/8 Frontend carga"
WEB_CODE=$(curl -fsS -o /dev/null -w "%{http_code}" "$WEB")
if [ "$WEB_CODE" != "200" ]; then
  red "    ❌ Frontend devolvió $WEB_CODE (esperado 200)"
  exit 1
fi
green "    ✓ $WEB → 200"

blue "7/8 SPA routing (rutas profundas no devuelven 404)"
SPA_CODE=$(curl -fsS -o /dev/null -w "%{http_code}" "$WEB/personajes")
if [ "$SPA_CODE" != "200" ]; then
  red "    ❌ /personajes devolvió $SPA_CODE (esperado 200 — _redirects mal configurado?)"
  exit 1
fi
green "    ✓ $WEB/personajes → 200 (SPA fallback OK)"

blue "8/8 Login con credenciales inválidas devuelve 401"
LOGIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"noexiste_smoke_test","password":"nada"}' || true)
if [ "$LOGIN_CODE" != "401" ]; then
  red "    ❌ Login con creds inválidas devolvió $LOGIN_CODE (esperado 401)"
  exit 1
fi
green "    ✓ POST /api/auth/login (creds inválidas) → 401"

echo ""
green "✅ TODOS LOS SMOKE TESTS PASAN"
echo "    Probado: $API + $WEB"
echo "    Personajes en BBDD: $COUNT"
echo "    Naruto roster: $NARUTO_COUNT"
