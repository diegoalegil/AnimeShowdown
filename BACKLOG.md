# BACKLOG.md

Hoja de ruta del proyecto AnimeShowdown. Estructurada en sprints. Cada sprint vive en su propia rama `sprint-N-<tema>` y se mergea a `main` por revisión humana vía PR squash.

> **Lee primero `AGENTS.md`** — convenciones permanentes del repo (autoría, archivos intocables, patrones prohibidos, condiciones de parada). Si algo aquí contradice `AGENTS.md`, este último gana.

---

## Resumen de sprints

| # | Sprint | Estado | Branch |
|---|---|---|---|
| 0 | Cleanup técnico + SEO técnico + repo hygiene | **ACTIVO** | `sprint-0-cleanup` |
| 1 | Visual polish (items pendientes) | PENDING (parcial) | `sprint-1-visual-polish` |
| 2 | Performance | PENDING | `sprint-2-performance` |
| 3 | A11y transversal | PENDING | `sprint-3-a11y` |
| 4 | SEO content + structured data avanzado | PENDING | `sprint-4-seo-content` |
| 5 | Backend security (audit findings pendientes) | PENDING | `sprint-5-security` |
| 6 | Test coverage | PENDING | `sprint-6-coverage` |
| 7 | Observabilidad + docs | PENDING | `sprint-7-obs-docs` |
| 8 | Image pipeline infrastructure | PARTIAL (plan doc done) | `sprint-8-image-pipeline` |
| ∞ | Image generation (humano + colab) | MANUAL TRACK | — |

---

## Workflow

1. Antes de tocar nada: `git checkout main && git pull --ff-only origin main`.
2. Lee `AGENTS.md` y este archivo.
3. Crea la rama del sprint desde `main` actualizado: `git checkout -b sprint-N-<tema>`.
4. Por cada PR del sprint:
   - Branch hija desde la rama del sprint, si quieres aislar más; o trabaja directo en la rama del sprint con commits granulares.
   - Verifica antes de commitear (`AGENTS.md` §8).
   - Auto-merge autorizado **solo** a la rama del sprint, nunca a `main`.
5. Tras cada PR mergeado, actualiza `PROGRESS.md`.
6. Al cierre del sprint: push final de la rama y **continuar con el siguiente sprint sin pausa** (autopilot multi-sprint activo hasta terminar el último), salvo que se active una condición de parada de AGENTS.md §7.


**Si la queue del sprint se agota antes del límite de tiempo**: stop, no inventes trabajo.

---

# SPRINT 0 — Cleanup técnico + SEO técnico + repo hygiene

**Branch:** `sprint-0-cleanup`
**Objetivo:** dejar el repo profesional, sin rastros internos de procesos automatizados, con SEO técnico saneado y listo para Google.

### PR 0.1 — Auditoría inicial y diagnóstico

**Files:** ninguno (read-only).
**Decisiones pre-tomadas:**
- Comandos a ejecutar: `git status`, `git log --oneline -20`, `ls *.md docs/*.md`, `npm run lint`, `npm run build:no-images`, `./mvnw -q test`.
- Buscar `console.log`, `debugger`, `TODO`, `FIXME` huérfanos.

**Tests:** todos los diagnósticos completos y reportados en el commit message del PR de cleanup (PR 0.2).
**Vetos:** no modificar nada en este PR — solo inventario.

### PR 0.2 — Limpieza pública del repo

**Files:** raíz del repo + `.gitignore`.
**Decisiones pre-tomadas:**
- Limpiar de comentarios de código cualquier mención a herramientas automatizadas. Mantener comentarios técnicos legítimos.

**Vetos:** no borrar contenido técnico real solo porque la palabra "audit" aparezca (ej: logs de seguridad, audit trail legítimo del backend).
**Commit:** `chore(repo): remove obsolete public artifacts and tighten gitignore`.

### PR 0.3 — Dead code frontend (seguro)

**Files:** `frontend/src/components/`, `frontend/src/pages/`, `frontend/src/lib/`, `frontend/src/hooks/`.
**Decisiones pre-tomadas:**
- ESLint con `--report-unused-disable-directives` para identificar imports/variables no usados.
- Borrar imports muertos, variables no usadas, comentarios obsoletos, `console.log` huérfanos.
- NO borrar componentes/helpers si tienen referencias dinámicas (string lookups, dynamic imports).
- NO borrar assets del catálogo de personajes/animes — pueden resolverse por string.

**Tests:** `npm run lint && npm run build:no-images` verdes.
**Vetos:** no refactor de arquitectura. No renombres masivos. No tocar componentes UI base listados en `AGENTS.md` §4.
**Commit:** `refactor(frontend): remove unused imports and dead code safely`.

### PR 0.4 — Dead code backend (seguro)

**Files:** `backend/src/main/java/`, `backend/src/test/java/`.
**Decisiones pre-tomadas:**
- Borrar imports muertos, métodos privados sin referencias, comentarios obsoletos.
- Reducir log spam (logs `INFO` sin valor).
- NO tocar: Auth, JWT, OAuth, TOTP, refresh tokens, DataSeeder, security config, CORS, rate limiting, WebSocket, Swagger, healthcheck, entities, repositories, migrations.

**Tests:** `./mvnw -q test` verde.
**Vetos:** no cambiar firmas de controllers. No borrar DTOs salvo confirmar 0 referencias en todo el repo (frontend + backend + tests).
**Commit:** `refactor(backend): remove unused code and reduce log noise`.

### PR 0.5 — SEO técnico: robots, sitemap, canonical, metadata

**Files:** `frontend/public/robots.txt`, `frontend/public/sitemap.xml` (o generador en `scripts/generate-sitemap.mjs`), `frontend/index.html`, `frontend/src/hooks/useSeo.js` o equivalente.
**Decisiones pre-tomadas:**
- Verificar `robots.txt` permite Googlebot y no bloquea assets.
- Sitemap incluye home, /personajes, /animes, /torneos, /ranking, /games, /faq, /apoya, páginas legales, y detail pages descubribles. Excluye admin, /perfil, rutas auth.
- Canonical absoluto a `https://animeshowdown.dev` por ruta.
- `<title>` único y `<meta name="description">` única por ruta via hook SEO existente.
- OG image fallback por ruta.

**Tests:** `curl -I https://animeshowdown.dev/sitemap.xml` devuelve 200. `curl https://animeshowdown.dev/robots.txt` permite Googlebot. Build verde.
**Vetos:** no añadir `noindex` accidental. No keyword stuffing. No URLs de admin en sitemap.
**Commit:** `fix(seo): align robots sitemap canonical and route metadata`.

### PR 0.6 — JSON-LD validación + breadcrumbs

**Files:** `frontend/src/lib/schema.js` o equivalente, páginas detail (`PersonajeDetailPage`, `AnimeDetailPage`, `TorneoDetailPage`).
**Decisiones pre-tomadas:**
- JSON-LD existente debe validar contra schema.org sin errores.
- Añadir BreadcrumbList en páginas detail (Home → Personajes → <slug>).
- Añadir WebSite + SearchAction en home si falta.

**Tests:** copy-paste del JSON-LD generado a https://validator.schema.org devuelve sin errores. Build verde.
**Vetos:** no inventar ratings, agregados ficticios, ni datos falsos.
**Commit:** `fix(seo): validate JSON-LD and add breadcrumb schema`.

### PR 0.7 — llms.txt + repo público hygiene final

**Files:** `frontend/public/llms.txt`, `README.md`, `docs/*.md`.
**Decisiones pre-tomadas:**
- `llms.txt` describe el producto y enlaza páginas principales en formato Markdown estructurado.
- README: estructura limpia, sin badges rotos, sin referencias internas, sin claims falsos. Mantener: stack, deploy info, setup local, links públicos.
- Mover detalles excesivos del README a `docs/`.

**Tests:** README renderiza bien en GitHub (mental check). `llms.txt` accesible.
**Vetos:** no inventar features. No exagerar. No menciones de herramientas automatizadas.
**Commit:** `docs(repo): streamline public presentation and add llms.txt`.

### PR 0.8 — Deploy readiness check

**Files:** `frontend/public/_redirects`, `frontend/public/_headers`, `frontend/vite.config.js` (revisar PWA + Workbox), `backend/.../config/SecurityConfig.java` (revisar headers).
**Decisiones pre-tomadas:**
- Verificar SPA fallback en `_redirects` está correcto (regla `/* /index.html 200` o equivalente).
- CSP / HSTS / Permissions-Policy ya configurados — solo verificar que no se rompieron.
- PWA manifest válido. SW genera correctamente.
- Cookies `SameSite=Lax` para refresh (regla de `AGENTS.md`).

**Tests:** build genera `dist/sw.js`. `_redirects` y `_headers` están en `dist/`.
**Vetos:** no debilitar CSP. No cambiar SameSite.
**Commit:** `fix(deploy): verify production routing and security headers`.

### PR 0.9 — SEO content checklist documentado

**Files:** `docs/SEO_READINESS_PLAN.md` (nuevo).
**Decisiones pre-tomadas:**
- Documento con: diagnóstico actual, acciones ya hechas en este sprint, acciones pendientes para Sprint 4, acciones externas necesarias (Google Search Console: añadir propiedad, enviar sitemap, inspeccionar URLs, revisar cobertura, monitorear Core Web Vitals).
- Plan de contenido futuro: páginas hub, FAQs, metodología ELO, rankings por anime, versus pages.
- Sin keyword stuffing ni promesas falsas.

**Tests:** lint markdown (si hay), revisión visual.
**Vetos:** no afirmar indexación si no se ha verificado.
**Commit:** `docs(seo): add search readiness plan and external action checklist`.

### PR 0.10 — Verificación final del sprint

**Files:** ninguno (verificación).
**Decisiones pre-tomadas:**
- Ejecutar full suite: `npm run lint && npm run build:no-images && ./mvnw -q test`.
- Smoke remoto: `curl -I https://animeshowdown.dev/`, `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `https://api.animeshowdown.dev/actuator/health`.
- Confirmar `git status` limpio, sin Co-authored-by en commits del sprint, sin rastros públicos remaining.

**Tests:** todos los checks verdes. Si algo rojo, **STOP** y reportar antes de pushear el sprint.
**Vetos:** no pushear con CI rojo persistente (misma causa, >4 reintentos sin progreso). Permitido autopilot resolver fallos reparables (lint, typos, imports, build errors menores). Fallos críticos (seguridad, auth, schema, migración irreversible) → parar y reportar.
**Acción final:** push de la rama `sprint-0-cleanup`. NO mergear a main.

---

# SPRINT 1 — Visual polish (items pendientes)

**Branch:** `sprint-1-visual-polish`

### PR 1.1 — Slug fixes para 8 animes sin imagen visible
**Files:** `backend/src/main/resources/personajes-seed.json` (fuente real del catálogo según asset plan).
**Decisiones:** verificar slugs vs `find frontend/img -type d`. Normaliza slugs en JSON, NO renombres archivos. Animes: Frieren, Spy x Family, Kaguya-sama, Bunny Girl Senpai, Mazinger Z, The Angel Next Door, Chuunibyou, Alya (Roshidere).
**Tests:** build verde + smoke `/animes` muestra los 8 sin placeholder.
**Vetos:** no inventar slugs nuevos. No renombrar webps.
**Commit:** `fix(catalog): normalize slugs for animes with missing image references`.

### PR 1.2 — Random Showdown #1/#2 covers
**Files:** `backend/src/main/resources/torneos-seed.json` (o frontend data si aún ahí).
**Decisiones:** slug `random-showdown-1` y `-2`. Nombre display mantener "Random Showdown #1". Si no hay asset en disco, AssetFallback cubre.
**Tests:** build + smoke `/torneos`.
**Vetos:** no hardcoded URLs.
**Commit:** `fix(torneos): normalize Random Showdown slugs for visible covers`.

### PR 1.3 — MHA Heroes vs Villains card visible
**Files:** componente que renderiza el bloque MHA en home.
**Decisiones:** grep `Heroes vs\|heroes-vs` en `frontend/src/`. Si asset no existe, `<AssetFallback kind="tournament">`.
**Tests:** build + smoke en home.
**Vetos:** no generar imagen.
**Commit:** `fix(home): restore MHA heroes vs villains card visibility`.

### PR 1.4 — Spinner premium (reemplazo del KanjiSpinner amarillo)
**Files:** `frontend/src/components/KanjiSpinner.jsx` o `PageLoader.jsx`.
**Decisiones:** accent gold del proyecto + aurora violeta. Anillo gradient + glow. Loop 1.2s. Respeta `prefers-reduced-motion`. No libs nuevas.
**Tests:** lint + build. Visual smoke al cargar ruta lazy.
**Vetos:** no cambiar firma del componente.
**Commit:** `feat(ui): redesign loading spinner with brand identity`.

### PR 1.5 — Asset plan: implementar tandas 1 (alta prioridad) según `docs/FRONTEND_VISUAL_ASSET_PLAN.md`
**Files:** componentes que consumen los assets de la tanda 1.
**Tests:** build + smoke visual.
**Vetos:** no implementar referencias a archivos que no existen.
**Commit:** `feat(visuals): integrate tanda 1 visual assets per asset plan`.

### PR 1.6 — Cleanup de fallbacks visuales redundantes tras integración
**Files:** componentes que consumían placeholders mientras faltaban assets reales.
**Decisiones:** solo aplica tras PR 1.5. Quitar AssetFallback de los slots que ya tienen asset real.
**Commit:** `refactor(visuals): remove redundant fallbacks after asset integration`.

---

# SPRINT 2 — Performance

**Branch:** `sprint-2-performance`

### PR 2.1 — Bundle analysis + report
**Files:** `frontend/scripts/analyze-bundle.mjs` (nuevo), `docs/PERFORMANCE.md` (nuevo).
**Decisiones:** usar `rollup-plugin-visualizer` (única dep nueva autorizada si no está). Output a `frontend/dist/bundle-report.html` (gitignored).
**Tests:** lint + build genera el report.
**Vetos:** no commit del HTML. No deps extras.
**Commit:** `perf(build): add bundle size analysis tooling`.

### PR 2.2 — Personaje3D lazy chunk verify
**Files:** `frontend/src/pages/PersonajeDetailPage.jsx`.
**Decisiones:** verificar `lazy(() => import('../components/Personaje3D'))`. Wrap con `<Suspense fallback={<Skeleton variant="card" />}>`.
**Tests:** build chunks. lint.
**Commit:** `perf(personaje): ensure 3D viewer is route-lazy with suspense fallback`.

### PR 2.3 — Lazy route audit completo
**Files:** `frontend/src/App.jsx` o router central.
**Decisiones:** todas las páginas con bundle >50KB deben usar `React.lazy()`. Suspense fallback compartido.
**Tests:** build chunks separados.
**Commit:** `perf(routes): convert remaining heavy pages to lazy chunks`.

### PR 2.4 — Image preload del hero crítico
**Files:** `frontend/index.html` o `frontend/src/components/Hero.jsx`.
**Decisiones:** 1 solo `<link rel="preload" as="image">` para hero above-the-fold. Si tiene `<picture>`, preload solo AVIF.
**Vetos:** máximo 1 preload.
**Commit:** `perf(hero): preload above-the-fold hero image`.

### PR 2.5 — Framer-motion eagerness audit
**Files:** componentes con `motion.*`.
**Decisiones:** identificar motion eager fuera del fold. Considerar `LazyMotion` de framer-motion.
**Vetos:** no remover animaciones existentes.
**Commit:** `perf(motion): defer framer-motion on below-fold components`.

---

# SPRINT 3 — A11y transversal

**Branch:** `sprint-3-a11y`

### PR 3.1 — Alt text audit + fixes
**Decisiones:** `grep -rn '<img ' frontend/src/ | grep -v 'alt='`. Fix uno por archivo.
**Commit:** `fix(a11y): add missing alt attributes across components`.

### PR 3.2 — Input labels
**Decisiones:** `grep -rn '<input ' frontend/src/ | grep -v 'aria-label\|htmlFor\|type="hidden"'`. Añade `<label htmlFor>` o `aria-label`.
**Commit:** `fix(a11y): associate labels with form inputs`.

### PR 3.3 — Buttons icon-only sin aria-label
**Decisiones:** botones icon-only obtienen `aria-label="<descripción>"`.
**Commit:** `fix(a11y): add accessible names to icon-only buttons`.

### PR 3.4 — Focus visible ring consistency
**Decisiones:** un solo focus ring style (accent + offset 2px). Aplicar donde falte.
**Commit:** `fix(a11y): unify focus-visible ring style across interactive elements`.

### PR 3.5 — Keyboard nav E2E expansion
**Files:** `frontend/e2e/keyboard-nav.spec.js` (nuevo).
**Decisiones:** test cubre home + personajes + votar.
**Commit:** `test(a11y): add keyboard navigation guardrail`.

---

# SPRINT 4 — SEO content + structured data avanzado

**Branch:** `sprint-4-seo-content`
**Nota:** depende de Sprint 0 (técnico) ya completo. Sprint 4 es contenido y schemas avanzados.

### PR 4.1 — JsonLd Person schema por personaje
**Files:** `frontend/src/pages/PersonajeDetailPage.jsx`, `frontend/src/lib/schema.js`.
**Decisiones:** `@type: "Person"` con name, image, description. Hook `<JsonLd>` reutilizable.
**Commit:** `feat(seo): add Person schema to character pages`.

### PR 4.2 — JsonLd Anime (CreativeWork/TVSeries)
**Files:** `frontend/src/pages/AnimeDetailPage.jsx`.
**Decisiones:** `@type: "TVSeries"` o `"Movie"`. Sin ratings inventados.
**Commit:** `feat(seo): add structured data for anime detail pages`.

### PR 4.3 — JsonLd Event para torneos
**Files:** `frontend/src/pages/TorneoDetailPage.jsx`, `EventoDetailPage.jsx`.
**Decisiones:** `@type: "Event"` con startDate/endDate.
**Commit:** `feat(seo): add Event schema for tournaments`.

### PR 4.4 — Contenido explicativo en hubs (sin spam)
**Files:** `frontend/src/pages/RankingPage.jsx`, `AnimesPage.jsx`, `GamesHubPage.jsx`.
**Decisiones:** párrafo introductorio corto (~80 palabras) explicando qué hace cada hub. Texto real útil, no keyword stuffing.
**Commit:** `feat(seo): add introductory content to public hubs`.

---

# SPRINT 5 — Backend security (audit findings pendientes)

**Branch:** `sprint-5-security`

### PR 5.1 — F006 anonymous vote bypass
**Files:** `backend/.../controller/VotoController.java`, `service/VotoService.java`, posible nuevo filter.
**Decisiones:** cookie httpOnly firmada HMAC con `JWT_SECRET`. Nombre `as_anon_id`. TTL 7 días. SameSite=Lax. Dedup hash(IP+UA+token) ventana 24h. Migration V30 con tabla `voto_anon_session`.
**Tests:** `VotoAnonControllerTest` nuevo: voto fresco OK, duplicado 429, tras 24h OK.
**Commit:** `fix(security): mitigate anonymous vote bypass via signed session cookie`.

### PR 5.2 — Audit log retention + purge cron
**Files:** `backend/.../service/AuditLogService.java`, nuevo `AuditLogCleanupJob.java`.
**Decisiones:** retención 90 días (eventos sensibles 30 días). Cron 03:00 UTC. Kill switch `app.audit.cleanup.enabled`.
**Commit:** `feat(security): add audit log retention policy with scheduled purge`.

### PR 5.3 — Security headers backend
**Files:** `backend/.../config/SecurityConfig.java`.
**Decisiones:** añadir `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
**Commit:** `fix(security): tighten backend HTTP security headers`.

### PR 5.4 — Rate limit tuning per endpoint
**Files:** `backend/.../config/RateLimitFilter.java`.
**Decisiones:** login 10/min, registro 5/min, reset-password 3/min, votos 60/min, newsletter 5/h. Excepción role ADMIN.
**Commit:** `fix(security): tune per-endpoint rate limits`.

### PR 5.5 — Avatar upload edge cases
**Files:** `backend/.../controller/AuthController.java`.
**Decisiones:** tests para MIME spoof, base64 padding malo, 0 bytes, justo 2MB.
**Commit:** `fix(security): cover avatar upload edge cases`.

### PR 5.6 — Password reset rate limit hardening
**Files:** `backend/.../service/PasswordResetService.java`.
**Decisiones:** 3 requests/24h por email. Tras límite, 200 OK genérico (no revelar). Log con email enmascarado.
**Commit:** `fix(security): harden password reset rate limit`.

---

# SPRINT 6 — Test coverage

**Branch:** `sprint-6-coverage`

### PR 6.1 — JaCoCo configuration
**Files:** `backend/pom.xml`.
**Decisiones:** plugin `jacoco-maven-plugin` 0.8.12. Goals: prepare-agent, report. Threshold 50% en services (warning, no bloqueante).
**Commit:** `chore(coverage): configure JaCoCo for backend coverage reports`.

### PR 6.2 — E2E votar flow
**Files:** `frontend/e2e/votar.spec.js` (nuevo).
**Commit:** `test(e2e): cover vote flow happy path`.

### PR 6.3 — E2E perfil flow
**Files:** `frontend/e2e/perfil.spec.js` (nuevo).
**Commit:** `test(e2e): cover profile page flow`.

### PR 6.4 — E2E login + OAuth callback (stubbed)
**Files:** `frontend/e2e/auth.spec.js` (nuevo).
**Commit:** `test(e2e): cover login and stubbed OAuth callback`.

### PR 6.5 — Unit tests para utilities sin cobertura
**Decisiones:** identificar utils sin test, añadir 1 test happy + 1 edge por clase.
**Commit:** `test(backend): cover utility classes lacking unit tests`.

---

# SPRINT 7 — Observabilidad + docs

**Branch:** `sprint-7-obs-docs`

### PR 7.1 — Sentry audit + ErrorBoundary global
**Files:** `frontend/src/main.jsx` o `App.jsx`.
**Decisiones:** wrap `<App />` con `<ErrorBoundary>` global. Mascara PII antes de Sentry.
**Commit:** `feat(observability): add global ErrorBoundary and Sentry PII guard`.

### PR 7.2 — Loading delay smoothing
**Files:** `frontend/src/hooks/useDeferredLoading.js` (nuevo).
**Decisiones:** skeleton se muestra solo si loading >300ms. Aplicar en 5 páginas core.
**Commit:** `perf(ui): smooth skeleton flash for fast responses`.

### PR 7.3 — ARCHITECTURE.md
**Files:** `docs/ARCHITECTURE.md` (nuevo).
**Decisiones:** secciones: Stack, Capas, Decisiones clave (ELO bracket-derived, JWT en memoria + refresh httpOnly, R2 storage), Flujos críticos, Deploy. ~400-600 líneas máx.
**Commit:** `docs(architecture): document stack layers and key decisions`.

### PR 7.4 — CHANGELOG.md generator setup
**Files:** `CHANGELOG.md` (nuevo), `scripts/generate-changelog.mjs` (nuevo).
**Decisiones:** Keep a Changelog format. Script `--dry-run` que lee git log entre tags.
**Commit:** `chore(release): add changelog scaffolding and generator`.

---

# SPRINT 8 — Image pipeline infrastructure

**Branch:** `sprint-8-image-pipeline`
**Nota:** el asset plan (`docs/FRONTEND_VISUAL_ASSET_PLAN.md`) ya existe en main. Este sprint construye la infraestructura. La generación creativa de assets es MANUAL TRACK (humano).

### PR 8.1 — Manifest generator script (cobertura asset por categoría)
**Files:** `scripts/generate-asset-manifest.mjs` (nuevo).
**Decisiones:** cruza `personajes-seed.json` y `torneos-seed.json` con assets reales en `frontend/img/` y `frontend/public/assets/`. Output `ASSET_MANIFEST.md` (gitignored). Tabla por categoría: `slug | categoría | ruta destino | variantes | estado`.
**Vetos:** no inventa slugs. No genera prompts creativos.
**Commit:** `chore(assets): add coverage manifest generator script`.

### PR 8.2 — R2 upload pipeline polish
**Files:** `scripts/sync-img-cdn.mjs` (existe — refuerzo).
**Decisiones:** idempotencia por hash. Modos `--dry-run`/`--plan`/`--apply`. Report de uploaded/skipped/errors. Credenciales solo via env vars `R2_*`.
**Commit:** `chore(assets): polish R2 upload pipeline with idempotency and reports`.

### PR 8.3 — Variants generation pipeline verify
**Files:** `frontend/scripts/generate-image-variants.mjs` (existe — verificar).
**Decisiones:** verifica genera 3 variantes (`-300`, `-600`, `-1024`). Idempotente. Skip si source no cambió.
**Commit:** `chore(assets): verify and document image variants generator`.

### PR 8.4 — Asset coverage admin tab
**Files:** `frontend/src/pages/AdminPage.jsx` (existe), nuevo endpoint `backend/.../controller/AdminAssetController.java`.
**Decisiones:** nueva tab "Assets" en admin. Muestra: total slots, % con asset real, % con AssetFallback. Endpoint cuenta slugs vs webps en disco.
**Vetos:** no exponer paths sensibles. No filesystem walk en endpoint público.
**Commit:** `feat(admin): add asset coverage visibility tab`.

### PR 8.5 — AssetFallback metrics tracking
**Files:** `frontend/src/components/AssetFallback.jsx` (existe), `frontend/src/lib/asset-tracking.js` (nuevo).
**Decisiones:** contador local en sessionStorage por categoría. Hook `useAssetFallbackStats()` para el admin tab.
**Vetos:** tracking 100% local, sin servicios externos.
**Commit:** `feat(observability): track AssetFallback usage locally`.

---

# MANUAL TRACK — Image generation (humano + colaboración)

No es un sprint de agente automatizado. Es un flujo de trabajo manual entre el humano y la colaboración asistida.

**Reparto operativo:**
- Asistente: estructura de carpetas, naming convention, manifest tracker, helpers de upload, plantillas estéticas reutilizables (paleta, mood, aspect ratio, dimensiones), integración técnica en componentes.
- Humano: dirección creativa específica (referencia visual por slot), ejecución en herramientas externas, curación de calidad, decisión final de qué entra al repo.

**Estados por entrada:** `PENDIENTE → GENERADO → APLICADO`.

**Cuando un asset queda APLICADO**, dispara PR de tipo `feat(visuals): integrate <category> assets — tanda N` (Sprint 1 PR 1.5 es el ejemplo).
