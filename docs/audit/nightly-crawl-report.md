# Nightly crawl — https://animeshowdown.pages.dev

> Generado: 2026-05-22T02:21:12.146Z
> Base URL: https://animeshowdown.pages.dev
> Script: `scripts/audit/nightly-crawl.mjs`
> Modo: HTTP fetch (no headless browser) — captura HTML inicial + probe HEAD a imágenes

## Resumen

| Métrica | Valor |
|---|---|
| Rutas testeadas | 12 |
| HTTP 200 OK | 12 |
| 404 control (ruta inexistente) | 0 ⚠ debería ser 1 |
| Errores de fetch | 0 ✓ |
| HTTP no esperado (no 200, no 404 control) | 0 ✓ |
| Rutas sin `<title>` | 0 ✓ |
| Rutas sin meta description | 0 ✓ |
| Rutas con imágenes rotas (en muestra) | 0 ✓ |
| Respuestas > 3s | 0 ✓ |

## Detalle por ruta

| Ruta | HTTP | Tiempo | Title | HTML KB | Imgs | Links |
|---|---|---|---|---|---|---|
| `/` | 200 | 305ms | AnimeShowdown — Torneos de personajes de anime | 16 | 1 | 0 |
| `/personajes` | 200 | 172ms | AnimeShowdown — Torneos de personajes de anime | 16 | 1 | 0 |
| `/personajes/luffy` | 200 | 53ms | AnimeShowdown — Torneos de personajes de anime | 16 | 1 | 0 |
| `/animes` | 200 | 50ms | AnimeShowdown — Torneos de personajes de anime | 16 | 1 | 0 |
| `/animes/one-piece` | 200 | 53ms | AnimeShowdown — Torneos de personajes de anime | 16 | 1 | 0 |
| `/torneos` | 200 | 53ms | AnimeShowdown — Torneos de personajes de anime | 16 | 1 | 0 |
| `/ranking` | 200 | 52ms | AnimeShowdown — Torneos de personajes de anime | 16 | 1 | 0 |
| `/votar` | 200 | 52ms | AnimeShowdown — Torneos de personajes de anime | 16 | 1 | 0 |
| `/glossary` | 200 | 52ms | AnimeShowdown — Torneos de personajes de anime | 16 | 1 | 0 |
| `/status` | 200 | 53ms | AnimeShowdown — Torneos de personajes de anime | 16 | 1 | 0 |
| `/duel-live` | 200 | 52ms | AnimeShowdown — Torneos de personajes de anime | 16 | 1 | 0 |
| `/ruta-que-no-existe` | 200 | 57ms | AnimeShowdown — Torneos de personajes de anime | 16 | 1 | 0 |

## SEO básico por ruta

| Ruta | Title | Meta description | Canonical | Robots | og:image |
|---|---|---|---|---|---|
| `/` | ✓ | ✓ | — | — | ✓ |
| `/personajes` | ✓ | ✓ | — | — | ✓ |
| `/personajes/luffy` | ✓ | ✓ | — | — | ✓ |
| `/animes` | ✓ | ✓ | — | — | ✓ |
| `/animes/one-piece` | ✓ | ✓ | — | — | ✓ |
| `/torneos` | ✓ | ✓ | — | — | ✓ |
| `/ranking` | ✓ | ✓ | — | — | ✓ |
| `/votar` | ✓ | ✓ | — | — | ✓ |
| `/glossary` | ✓ | ✓ | — | — | ✓ |
| `/status` | ✓ | ✓ | — | — | ✓ |
| `/duel-live` | ✓ | ✓ | — | — | ✓ |
| `/ruta-que-no-existe` | ✓ | ✓ | — | — | ✓ |

## Hallazgos detallados

_Sin hallazgos — todas las rutas devuelven HTTP esperado, tienen title + meta, y la muestra de imágenes probadas responde 2xx._

---

## Limitaciones

- **No ejecuta JS** — solo ve el HTML inicial servido por Cloudflare. Si la app es SPA y el title/meta los inyecta React tras hidratar, este crawler verá los valores fallback (`index.html` template).
- **Probe de imágenes limitado a 3 por ruta** — para no sobrecargar el CDN. Una auditoría exhaustiva de imágenes rotas requeriría rastrear `frontend/img/` contra `personajes-seed.json` (eso ya lo hace `scripts/audit/catalog-quality.mjs`).
- **No detecta errores de consola** — para eso haría falta un headless browser (Playwright). Se podría añadir como follow-up si compensa instalar la dep en CI.
- **404 control esperado**: la ruta `/ruta-que-no-existe` debe responder 404 en Cloudflare Pages (sirve `404.html` si existe, o el index para SPA). Si responde 200 con el shell de la app, la SPA se encarga de mostrar el "Not Found" pero los crawlers SEO lo verán como 200 — eso es deuda conocida de SPAs sin SSR.
