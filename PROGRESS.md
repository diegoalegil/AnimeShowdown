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
- 2026-05-25T22:52:38.1875367+01:00 | PR AUTO-02.2 / #45 | 5ac43a6f | verify: `node --version` v24.16.0; `npm run lint` PASS; `npm run build:no-images` PASS; `npm run test:a11y` PASS (12/12); `npm run test:e2e:responsive` PASS (16/16); CI PASS | decisions: se anade gate axe-core para rutas publicas clave y se corrigen contrastes/list semantics detectados por el gate.
- 2026-05-25T23:19:09.0924706+01:00 | PR AUTO-02.3 / #46 | 23e713ff | verify: `node --version` v24.16.0; `npm run lint` PASS; `npm run build:no-images` PASS; `npm run test:a11y` PASS (15/16 + 1 skipped); `npm run test:e2e:responsive` PASS (16/16); CI PASS | decisions: se cubre teclado para skip link y foco atrapado/Escape en menu movil.
- 2026-05-25T23:31:26.5051429+01:00 | PR AUTO-02.4 / #51 | 6faedd39 | verify: `node --version` v24.16.0; `npm run lint` PASS; `npm run build:no-images` PASS; `npm run test:a11y` PASS (15/16 + 1 skipped); CI PASS | decisions: se aplica `MotionConfig reducedMotion="user"` para que Framer respete preferencias de movimiento en toda la app.
- 2026-05-25T23:51:42.0990047+01:00 | PR AUTO-02.5 / #52 | fe6aee78 | verify: `node --version` v24.16.0; `npm run lint` PASS; `npm run build:no-images` PASS; `npm run test:a11y` PASS (35/36 + 1 skipped); `npm run test:e2e:responsive` PASS (16/16); CI PASS | decisions: se amplia axe a rutas estaticas/legales y se corrigen contrastes, links distinguibles, `pre` focusable y semantica `dl` del glosario.
- 2026-05-26T00:07:34.2640803+01:00 | PR AUTO-02.6 / #53 | 7b5803ad | verify: `node --version` v24.16.0; `npm run lint` PASS; `npm run build:no-images` PASS; `npm run test:a11y` PASS (55/56 + 1 skipped); `npm run test:e2e:responsive` PASS (16/16); CI PASS | decisions: se amplia axe a votar/eventos/comparar/descubre/juegos diarios y se corrige contraste en Omikuji.
- 2026-05-26T00:19:59.0103679+01:00 | PR AUTO-02.7 / #54 | d5b79de1 | verify: `node --version` v24.16.0; `npm run lint` PASS; `npm run build:no-images` PASS; `npm run test:a11y` PASS (57/58 + 1 skipped); `npm run test:e2e:responsive` PASS (16/16); CI PASS | decisions: se localiza el live region de Sonner y se anade test de regresion para `aria-live="polite"`.
- 2026-05-26T00:42:09.1214931+01:00 | PR AUTO-02.8 / #55 | 4760765c | verify: `node --version` v24.16.0; `npm run lint` PASS; `npm run build:no-images` PASS; `npm run test:a11y` PASS (81/82 + 1 skipped); `npm run test:e2e:responsive` PASS (16/16); CI PASS | decisions: se amplia axe a auth, cuenta, 404 y rutas de usuario; se corrigen contraste y enlaces distinguibles detectados en Logros y Leaderboards.

## Sprint Auto 02 cierre

- 2026-05-26T00:43:14.1573693+01:00 | done: PR AUTO-02.1, AUTO-02.2, AUTO-02.3, AUTO-02.4, AUTO-02.5, AUTO-02.6, AUTO-02.7, AUTO-02.8 | skipped: 0 | failed: 0 | result: axe WCAG A/AA cubre 39 rutas en desktop/mobile mas flujos de teclado y live region; CI verde en todos los PRs; queue segura agotada para Sprint 2.

## Tanda 3 visual side-stream

- 2026-05-25T23:19:09.0924706+01:00 | PR VISUALS-3.1 / #47 | a6520097 | verify: CI parcial; `sync-personajes` quedo con drift por assets WIP y se corrigio despues con #48, d1f9c63f y 11e0fa2e | decisions: batch visual concurrente aceptado como assets; no se promovieron formas finales como personajes independientes.
- 2026-05-25T23:19:09.0924706+01:00 | PR VISUALS-3.2 / #49 | 6503774a | verify: CI parcial; `sync-personajes` quedo con drift por formas finales y se corrigio despues con d1f9c63f/11e0fa2e | decisions: se restauran SSR base y las formas finales quedan como variantes visuales WIP.
- 2026-05-25T23:19:09.0924706+01:00 | PR VISUALS-3.3 / #48 | 18136cd7 | verify: `node scripts/sync-personajes.mjs --check` PASS; `node --version` v24.16.0; `npm run lint` PASS; `npm run build:no-images` PASS; CI PASS | decisions: se allowlistean temporalmente slugs de tanda 3 pendientes sin publicarlos como catalogo.
- 2026-05-25T23:19:09.0924706+01:00 | VISUALS-3.4 | d1f9c63f, 11e0fa2e | verify: `node scripts/sync-personajes.mjs --check` PASS (1086 = 1086) tras `git pull --ff-only`; CI verde en los checks posteriores | decisions: formas finales permanecen WIP; 34 personajes nuevos pasan a seed curado.
- 2026-05-25T23:19:09.0924706+01:00 | PR #50 | skipped | verify: no mergeado; cerrado | decisions: PR duplicado superseded por d1f9c63f/11e0fa2e para evitar conflicto stale.

## Sprint Auto 03 - Mobile responsive deep audit

- 2026-05-26T01:04:22.0598895+01:00 | PR AUTO-03.1 / #56 | bcf35bfa | verify: `node --version` v24.16.0; `npm run lint` PASS; `npm run build:no-images` PASS; `npm run test:e2e:responsive` PASS (9/18 + 9 skipped); CI PASS | decisions: responsive gate pasa de home-only a 12 rutas clave x 9 viewports efectivos, incluye 320px y evita duplicado de proyecto movil para mantener CI rapido.
- 2026-05-26T02:34:42.0000000+01:00 | PR AUTO-03.2 / #57 | 8ec6b705 | verify: `node --version` v24.16.0; `npm run lint` PASS; `npm run build:no-images` PASS; `npm run test:e2e:responsive` PASS (11/22 + 11 skipped); CI PASS | decisions: gate de touch targets >=44px para rutas clave y panel movil; header/footer/filtros/ranking/votar/notificaciones ajustados para cumplir el minimo tactil.
- 2026-05-26T14:51:33.5525698+01:00 | PR AUTO-03.3 / #60 | 29e70b54 | verify: `node --version` v24.16.0; `npm run lint` PASS; `npm run build:no-images` PASS; `npm run test:e2e:responsive` PASS (11/22 + 11 skipped); CI PASS | decisions: se estabilizan safe-area insets en bottom nav, drawer movil, dialogs y FAB de filtros; se anade contencion global de overflow horizontal.
- 2026-05-26T15:16:55.0047979+01:00 | PR AUTO-03.4 / #61 | 4ac5fe2c | verify: `node --version` v24.16.0; `npm run lint` PASS; `npm run build:no-images` PASS; `npm run test:e2e:responsive` PASS (11/22 + 11 skipped); CI PASS | decisions: se centraliza la affordance de scroll horizontal y se aplica a brackets, carruseles, galeria, tabs y tabla tecnica sin tocar backend ni assets.
- 2026-05-26T15:36:57.6775575+01:00 | PR AUTO-03.5 / #62 | 414552a7 | verify: `node --version` v24.16.0; `npm run lint` PASS; `npm run build:no-images` PASS; `npm run test:e2e:responsive` PASS (11/22 + 11 skipped); CI PASS | decisions: se preserva clearance de footer contra bottom nav con safe-area real; Sprint Auto 03 cerrado y siguiente bloque prioritario es Sprint 3.5a.
