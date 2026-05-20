# Audit autopiloto 2026-05-20

## Línea base
- Backend tests: PASS (154/154)
- Frontend lint: PASS
- Frontend build: PASS (`npm run build:no-images`)
- Estado inicial: solo frontend/public/sitemap.xml generado por build previo, no se commitea

## Hallazgos
- [x] P0: Erased/Fullmetal devolvían text/html en producción para varios .webp por rename case-only y fallback SPA de Cloudflare Pages.
- [x] P1: AuditLog OAuth pasaba HttpServletRequest a @Async y Tomcat lo reciclaba antes de persistir IP/User-Agent.

## Fixes pusheados
- `9c99b08` — `fix(audit): capturar contexto antes del async OAuth`
- `9060070` — `fix(img): cache-bust Erased y Fullmetal tras rename case-only`
- `05734d2` — `fix(img): versionar rutas cacheadas de Erased y Fullmetal`

## Pendientes no tocados
- Revisar deuda de chunks grandes (Personaje3D/personajes) en sprint de performance dedicado.
- Mantener `frontend/public/sitemap.xml` fuera del commit cuando lo regenere el build local.
- Los `*-1024.webp` de Erased/Fullmetal están ignorados por `.gitignore`; el cache-bust se aplicó y commiteó solo sobre los 75 assets trackeados.
- Cloudflare conservaba `index.html` como HIT immutable bajo las rutas sin query; `imagenPersonaje()` versiona solo Erased/Fullmetal para forzar un cache key nuevo.
- En este repo local queda configurado `git config core.ignorecase false` para detectar futuros renames case-only antes de pushearlos.
