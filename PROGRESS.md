# Sprint Progress

- 2026-05-25T19:57:36.2982942+01:00 | PR 8.1 | 2127202c | verify: `node --version` v24.16.0; `npm run lint` PASS; `npm run build:no-images` PASS | decisions: manifest local `ASSET_MANIFEST.md` queda gitignored; cobertura por card, portrait, banner de personaje, banner de anime y banner de torneo.
- 2026-05-25T20:00:56.0174780+01:00 | PR 8.2 | 38ba02d6 | verify: `node scripts/sync-img-cdn.mjs --plan` PASS; `node --version` v24.16.0; `npm run lint` PASS; `npm run build:no-images` PASS | decisions: sync remoto usa hash `sha256` como metadata, mantiene compatibilidad con `--aws-dry-run` y deja `--dry-run` como alias publico.
- 2026-05-25T20:03:19.6347548+01:00 | PR 8.3 | af884ee9 | verify: `npm run build:images:check` PASS; `node --version` v24.16.0; `npm run lint` PASS; `npm run build:no-images` PASS | decisions: `--check` audita variantes sin escribir archivos; `--strict` queda disponible para bloquear si missing/stale debe ser cero.
- 2026-05-25T20:08:39.1712758+01:00 | PR 8.4 | be55970e | verify: `node --version` v24.16.0; `npm run lint` PASS; `npm run build:no-images` PASS; `./mvnw -q test` PASS | decisions: endpoint admin-only devuelve solo totales por categoria, sin rutas absolutas ni filesystem walk publico.
- 2026-05-25T20:12:37.4642444+01:00 | PR 8.5 | 058423e4 | verify: `node --version` v24.16.0; `npm run lint` PASS; `npm run build:no-images` PASS | decisions: contador de AssetFallback vive solo en `sessionStorage` y se expone al admin mediante hook local.

## Sprint 8 cierre

- 2026-05-25T20:13:34.2946261+01:00 | done: PR 8.1, 8.2, 8.3, 8.4, 8.5 | skipped: 0 | failed: 0 | branch: `sprint-8-image-pipeline` | decision: queue agotada, listo para revision humana sin merge a `main`.

## Sprint Auto 01 - Performance LCP + bundle budget

- 2026-05-25T21:41:34.8205120+01:00 | PR AUTO-01.1 / #38 | 2dea0143 | verify: `node --version` v24.16.0; `npm run lint` PASS; `npm run build:no-images` PASS; `npm run test:bundle` PASS (`initial js` 183.2KB gzip <= 220KB); preview smoke `/`, `/personajes`, `/ranking`, `/games` PASS; CI PASS | decisions: `Splash` carga lazy, Framer no se modulepreload en HTML inicial y el budget mide JS inicial agregado desde `dist/index.html`.
- 2026-05-25T21:49:52.0445835+01:00 | PR AUTO-01.2 / #39 | 62e50a5a | verify: `node --version` v24.16.0; `npm run lint` PASS; `npm run build:no-images` PASS; `npm run test:bundle` PASS (`initial js` 183.2KB gzip <= 220KB); CI PASS | decisions: se anaden `preconnect` y `dns-prefetch` al CDN de imagenes sin aumentar el numero de preloads iniciales.
- 2026-05-25T21:57:31.4282412+01:00 | PR AUTO-01.3 / #40 | a2bd0f76 | verify: `node --version` v24.16.0; `npm run lint` PASS; `npm run build:no-images` PASS; `npm run test:bundle` PASS (`initial js` 183.2KB gzip <= 220KB); CI PASS | decisions: se elimina el `@import` remoto duplicado de Noto Sans JP para centralizar carga de fuentes en el documento.
- 2026-05-25T22:05:37.0489313+01:00 | PR AUTO-01.4 / #41 | 959bbdc8 | verify: `node --version` v24.16.0; `npm run lint` PASS; `npm run build:no-images` PASS; `npm run test:bundle` PASS (`initial js` 183.2KB gzip <= 220KB); CI PASS | decisions: se anaden dimensiones intrinsecas a imagenes fijas y previews para reducir incertidumbre de layout.
- 2026-05-25T22:13:51.5420717+01:00 | PR AUTO-01.5 / #42 | 4e2b16c2 | verify: `node --version` v24.16.0; `npm run lint` PASS; `npm run build:no-images` PASS; `npm run test:bundle` PASS (`initial js` 183.4KB gzip <= 220KB); CI PASS | decisions: el warmup de rutas pasa a ejecutarse tras `load`, escalonado en idle y desactivado en Data Saver/2G.
- 2026-05-25T22:22:00.0827534+01:00 | PR AUTO-01.6 / #43 | d1596c3b | verify: `node --version` v24.16.0; `npm run lint` PASS tras corregir import; `npm run build:no-images` PASS; `npm run test:bundle` PASS (`initial js` 181.1KB gzip <= 220KB); CI PASS | decisions: Web Vitals pasa a import dinamico post-load/idle para sacar observabilidad no critica del JS inicial.

## Sprint Auto 01 cierre

- 2026-05-25T22:23:27.8514534+01:00 | done: PR AUTO-01.1, AUTO-01.2, AUTO-01.3, AUTO-01.4, AUTO-01.5, AUTO-01.6 | skipped: 0 | failed: 0 | result: initial JS 181.1KB gzip <= 220KB; CI verde en los PRs; queue de Sprint 1 agotada para cambios seguros de bajo riesgo.

## Sprint Auto 02 - Accessibility WCAG 2.2 AA estricto

- 2026-05-25T22:33:33.9933490+01:00 | PR AUTO-02.1 / #44 | 60ce3129 | verify: `node --version` v24.16.0; `npm run lint` PASS; `npm run build:no-images` PASS; CI PASS | decisions: se anade skip link visible por teclado y target `main` focusable para navegacion rapida al contenido.
