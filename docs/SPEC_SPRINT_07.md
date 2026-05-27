# SPEC — Sprint Auto 07 (Error handling + boundaries granular)

> **Status**: pre-cocinado por Claude el 2026-05-27 mientras Codex está sin tokens (vuelve ~05-30).
> **Branch**: `sprint-auto-07-errors`.
> **Estimated PRs**: 6 (alineado con backlog 5-7).
> **Goal mínimo**: ningún flujo crítico muestra error genérico al usuario. Cada error tiene mensaje accionable + reintento donde aplica + breadcrumb a Sentry.
> **Non-negotiables**: no romper E2E existente (26+ tests), no cambiar contrato API público (responses backend deben mantener status code + body shape; solo se *enriquece*), no tocar archivos intocables listados en SPEC_SPRINT_06.md §4.

---

## 1. Estado actual (inventario 2026-05-27)

### Frontend
- **`ErrorBoundary` único** (`src/components/ErrorBoundary.jsx`, 175 LOC):
  - Es la única boundary del proyecto.
  - Se usa en `src/main.jsx` (wrapper top-level absoluto) + 1 sub-uso en `InicioPage.jsx`.
  - Tiene lógica especial de "stale asset detectado; recargando shell" (auto-reload cuando detecta versión vieja).
  - Captura via `console.error`. NO envía explícitamente a Sentry — depende de que Sentry capture lo que React loguea.
- **`NotFoundPage`** (`src/pages/NotFoundPage.jsx`, 57 LOC):
  - Visual decente con `EmptyState` + 2 CTAs (Home, /personajes).
  - `noindex: true` correctamente.
  - **Falta**: sugerencias basadas en URL fallada, search inline, links a otros hubs (animes/torneos/games), telemetría a Sentry.
- **`api.ts`** retry con backoff:
  - Implementado parcialmente (líneas 214, 265-269): backoff 300/700/1100ms con `Retry-After` honored.
  - Aplica a 429/503 transient. NO aplica a 502/504 ni a network errors crudos (fetch reject).
- **Sentry** (`src/lib/sentry.js`):
  - `Sentry.init()` con `browserTracingIntegration` + `replayIntegration`.
  - `sendDefaultPii: false` (decisión explícita GDPR).
  - **Falta**: enrichment con `user.id`, `tags.feature`, `breadcrumbs` per-route, captureException explícito desde ErrorBoundary.

### Backend
- **`GlobalExceptionHandler`** (`exception/GlobalExceptionHandler.java`, 215 LOC) con 11 `@ExceptionHandler`:
  - `MethodArgumentNotValidException` → 400 (validation)
  - `EntityNotFoundException` → 404
  - `DataIntegrityViolationException` → 409
  - `HttpMessageNotReadableException` → 400 (malformed JSON)
  - `MethodArgumentTypeMismatchException` → 400 (path/query type)
  - `BadCredentialsException` → 401
  - `AccessDeniedException` → 403
  - `NoHandlerFoundException` → 404 (route no existe)
  - `IllegalArgumentException`/`IllegalStateException` → 400/500
  - `ResponseStatusException` → passthrough
  - `Exception` (catch-all) → 500
- **Falta**:
  - Response shape no está estandarizado (algunos devuelven `Map`, otros `String`, otros object literal).
  - `traceId` no se incluye → debugging post-incidente difícil.
  - `Sentry.captureException` server-side no está enganchado (solo frontend).

### E2E existente que cubre errores
- `auth.spec.js` cubre login con credenciales malas (toast 401).
- `critical-state.spec.js` cubre `VerifyPage` one-shot (404 → mensaje).
- **No cubre**: 500, network offline, rollback de optimistic mutations.

---

## 2. Plan de 6 PRs (orden barato → caro)

### PR 07.1 — ErrorBoundary granular + fallback API

- **Goal**: que cada hub (Votar, Ranking, Personajes, Animes, Torneos, Games, Perfil) tenga su propio `ErrorBoundary` con fallback custom. Si una sección revienta, solo cae esa sección, no la página entera.
- **Files**:
  - `src/components/ErrorBoundary.jsx` — añadir prop `fallback={({ error, reset }) => ...}` (render-prop), prop `tag` (string para enviar a Sentry como tag), y `onError` (callback para custom logging).
  - Aplicar en: `VotarPage`, `RankingPage`, `PersonajesPage`, `AnimesPage`, `TorneosPage`, `GamesHubPage`, `PerfilPage`, `AnimeDetailPage`, `PersonajeDetailPage`. Cada uno con un fallback EmptyState propio + botón reset.
  - Test E2E mínimo: forzar throw en un componente hijo y verificar que solo ese hub cae (mockear via `?error=force` query param en dev mode).
- **No tocar**: el wrap top-level de `main.jsx` (queda como red de último recurso).
- **Verify**:
  - Lint, typecheck, vitest, build verde
  - Manual: navegar a una página, forzar error de render en un componente lazy, confirmar que el resto del shell sigue funcional.
  - Sentry: confirmar que un test event aparece con `tag: feature=ranking`.

### PR 07.2 — NotFoundPage upgrade con sugerencias contextuales

- **Goal**: 404 deja de ser un dead-end. Sugiere ruta probable + búsqueda inline + atajos a hubs.
- **Files**:
  - `src/pages/NotFoundPage.jsx` — añadir:
    - Sección "¿Buscabas esto?" con sugerencias derivadas de `useLocation().pathname`:
      - Si `/personaje/xxx` (singular) → sugerir `/personajes/xxx`
      - Si contiene un slug existente (matchear contra `personajes-catalog`/aliases) → link directo a la ficha real
      - Si `/anime/xxx` → sugerir `/animes/xxx`
      - Fallback: 3 hubs más populares (Votar, Ranking, Animes)
    - Input search inline (reusa `CommandPalette` o variante simple) que filtra catálogo de personajes en cliente.
    - Reporte a Sentry con `Sentry.captureMessage('404', { extra: { pathname } })` + `tag: error=404`.
  - `src/lib/personajes-core.ts` — exportar helper `fuzzyMatch(query, top: 5)` si no existe (revisar; ya hay `buscarPersonajes`, posiblemente usable directo).
- **No tocar**: `noindex: true` (mantener — 404 no debe rankear en SEO).
- **Verify**:
  - Test unit: `fuzzyMatch('luffi', 5)` devuelve `luffy_gear5` o `monkey-d-luffy` en top 1.
  - Test E2E: navegar a `/personaje/luffy` (singular falso) → verificar que aparece sugerencia con link a `/personajes/monkey-d-luffy`.

### PR 07.3 — Unexpected error page (boundary fallback enriched)

- **Goal**: cuando una boundary se dispara, el fallback es accionable (no genérico "algo salió mal"). Reintento + reporte a Sentry + link a `/status` (status page externa).
- **Files**:
  - `src/components/ErrorBoundary.jsx` — el fallback default (cuando no se pasa custom) renderiza:
    - Visual: `EmptyState scene` con `BRAND_VISUALS.error`.
    - Mensaje: "Algo se rompió en esta sección" + `error.message` truncado a 100 chars (NO stack — sensible).
    - Botones:
      1. "Reintentar" → llama a `reset()` (reset state de la boundary)
      2. "Volver al inicio" → navigate('/')
      3. "Reportar" (opcional, abre mailto: o copia error ID al clipboard)
    - Footer: `Error ID: <sentry_event_id>` + link "Ver estado del servicio" a `https://status.animeshowdown.dev` (asume que existe o crear como TODO).
  - `src/components/ErrorBoundary.jsx::componentDidCatch` — llamar `Sentry.captureException(error, { extra: { componentStack, tag: this.props.tag } })` y guardar `eventId` en state para mostrarlo en el fallback.
- **No tocar**: la lógica de "stale asset detectado; recargando shell" — esa rama es ortogonal al fallback UI.
- **Verify**:
  - Test unit: ErrorBoundary captura error en hijo y renderiza fallback con eventId disponible.
  - Lighthouse en página con boundary triggered (manual): a11y ≥ 95.

### PR 07.4 — Network errors UX + optimistic rollback

- **Goal**: cuando la red falla, el usuario lo sabe y puede reintentar. Cuando una mutation optimista falla, el rollback es visible (no silencioso).
- **Files**:
  - `src/lib/api.ts` — exponer evento `ApiError.kind` con valores:
    - `network` (fetch reject crudo)
    - `timeout` (signal abort por timeout)
    - `server` (5xx)
    - `client` (4xx)
    - `unauthorized` (401)
    - `forbidden` (403)
    - `validation` (400 con body de validation errors)
  - Extender retry a `network` y `502/504` con backoff 500/1500/3500.
  - `src/components/Toaster.jsx` (o donde estén los toasts globales) — añadir variant `network-error` con CTA "Reintentar" si la mutation tenía un retry handler asociado.
  - Mutations optimistas críticas:
    - Vote (`votarPersonaje`): si falla → toast "Voto no contabilizado" + rollback estado local.
    - Favorito: si falla → toast + rollback heart icon.
    - Comentario: si falla → toast "No publicado" + restaurar input.
  - Detectar offline con `navigator.onLine` + `window.addEventListener('offline'/'online')` → banner global "Sin conexión" cuando offline.
- **Verify**:
  - Test unit: `api.ts` distingue los 7 `ApiError.kind`.
  - Test E2E: mock fetch → reject `Failed to fetch` en un voto → confirmar toast aparece + heart vuelve a estado previo.

### PR 07.5 — Backend `ErrorResponse` DTO estandarizado

- **Goal**: todos los handlers de `GlobalExceptionHandler` devuelven el mismo shape. Cliente puede confiar en el contrato.
- **Files**:
  - `backend/src/main/java/.../exception/ErrorResponse.java` (nuevo): record con:
    ```java
    public record ErrorResponse(
        String code,        // "VALIDATION_FAILED", "NOT_FOUND", etc.
        String message,     // mensaje legible
        Instant timestamp,
        String path,        // request URI
        String traceId,     // de MDC.get("traceId") o null
        Map<String, Object> details // opcional, para validation errors etc.
    ) {}
    ```
  - `GlobalExceptionHandler.java` — migrar los 11 handlers existentes para devolver `ResponseEntity<ErrorResponse>` en lugar de `Map`/`String`/etc.
    - Mapear cada exception a un `code` estable:
      - `MethodArgumentNotValidException` → `code: "VALIDATION_FAILED"`
      - `EntityNotFoundException` → `code: "NOT_FOUND"`
      - `DataIntegrityViolationException` → `code: "CONFLICT"`
      - etc.
  - `pom.xml` — añadir Sentry SDK Java si no está (revisar `pom.xml` primero) — opcional, si no añadir TODO.
  - `GlobalExceptionHandler.Exception::handleGeneric` → llamar `Sentry.captureException(ex)` server-side antes de devolver 500.
- **Backward compat**: dado que solo se añaden campos al body (no se quitan), clientes existentes (frontend, tests E2E) deberían seguir funcionando. Verificar.
- **Test backend**:
  - `GlobalExceptionHandlerTest` — para cada exception type, validar que el body es `ErrorResponse` shape.
  - Captor Mockito en `Sentry.captureException` para el handler catch-all.
- **No tocar**: el HTTP status code de cada handler (es contrato público).

### PR 07.6 — Sentry context enrichment + feature breadcrumbs

- **Goal**: cuando algo falla en prod, Sentry tiene el contexto suficiente para debug sin abrir DevTools del usuario.
- **Files**:
  - `src/lib/sentry.js`:
    - Añadir `Sentry.setUser({ id: useAuthStore.id })` en login/logout flow.
    - Añadir `Sentry.setTag('feature', <hub_name>)` al navegar entre hubs (hook en router).
    - `beforeSend` que filtra los errores que vienen de extensions de browser (regex en `error.stack`).
  - Cada hub (Votar, Ranking, etc.) emite breadcrumb cuando el usuario hace acciones clave (voto enviado, ranking cargado, torneo claim, etc.) usando `Sentry.addBreadcrumb({ category: 'feature', level: 'info', data: {...} })`.
  - `src/components/ErrorBoundary.jsx` — usar `Sentry.withScope` para attachear `componentStack` y `props.tag`.
  - Backend (opcional, si SDK está): `MDC.put("user.id", ...)` en el filtro de auth + Sentry hook para incluir MDC en el evento server-side.
- **Verify**:
  - Manual: en dev con DSN de Sentry test, forzar un error → verificar evento con `tag: feature=ranking`, `user.id`, breadcrumbs de últimas 5 acciones.

---

## 3. Coverage gates / verify finales

| Capa | Métrica | Antes Sprint 7 | Tras Sprint 7 |
|---|---|---|---|
| Frontend boundaries | 1 (top-level) | 1 + 9 hubs |
| 404 sugerencias contextuales | 0 | dinámicas por URL |
| Sentry breadcrumbs/route | ninguno | 1+ por hub |
| Backend ErrorResponse standarized | 0/11 handlers | 11/11 handlers |
| Backend traceId in errors | no | sí |
| Network retry kinds | 2 (429/503) | 7 con backoff escalonado |

---

## 4. Heads-up para Codex

- **PR 06.1 (Vitest) ya está mergeado** — usa `vitest run` para los tests unit nuevos de boundaries y `fuzzyMatch`.
- **Coverage threshold subirá durante Sprint 6** — no asumas que estás en el mismo punto: lee `vitest.config.js` al arrancar Sprint 7 para ver el umbral vigente.
- **AGENTS.md §1 sigue**: no `Co-Authored-By` en commits a main. Sí en branches.
- **Direct-push a main** autorizado para `docs(progress)` post-merge.
- **No tocar**:
  - V1-V29 Flyway migrations
  - cacheNames v3
  - PrometheusScrapeAuthFilter.java
  - i18n detection.order ['localStorage']
  - refresh cookie SameSite=Lax
  - playwright retries: 2
  - El HTTP status code de cada handler en GlobalExceptionHandler (solo se enriquece body).
- **Si Sentry SDK Java no está instalado**: anotar como TODO en PR 07.6 y NO añadir la dep en este sprint — esa es decisión de costes que pasa por el user.
- **Sobre `status.animeshowdown.dev`** (link en PR 07.3): si no existe el dominio, el link queda inert o apunta a `/status` que renderiza un placeholder. Crear como TODO trackeado, no bloquear el PR.

---

## 5. Qué evitar

- ❌ Cambiar el HTTP status code de handlers existentes. Es contrato público; clientes externos pueden romperse.
- ❌ Capturar `error.stack` completo en el fallback UI (sensible — el stack puede leakear paths internos).
- ❌ `console.log` en producción para debug — usa `Sentry.captureMessage` o breadcrumbs.
- ❌ Toasts globales para errores 401 (ya hay un flow específico de re-auth en `api.ts`). Solo network/server.
- ❌ Reintentar 4xx automáticamente (el cliente está mal, no es transient). Solo retry para network/5xx/429/503.
- ❌ Mostrar al usuario un `traceId` salvo en página de 500 — es ruido cognitivo en errores menores.
- ❌ Hacer cambios de tipo "refactor preventivo" en handlers que YA funcionan. Sprint 7 *enriquece*, no rediseña.

---

## 6. Verify checklist por cada PR

```bash
# Frontend
cd frontend
npm run lint
npm run typecheck
npm test
npm run test:coverage   # debe seguir verde con threshold vigente
npm run build:no-images

# Backend
cd backend
mvn -B test
mvn -B verify           # JaCoCo check

# E2E
cd frontend
npx playwright test e2e/

# Git
git diff --check
```

PR description:

```markdown
## Resumen
Sprint Auto 07 — PR 07.X de 6.

## Verify
- node --version: v22.22.2
- npm run lint: PASS
- npm run typecheck: PASS
- npm test: PASS (X new boundary/error tests, Y total)
- npm run test:coverage: lines X%, branches Y% (sin regresión)
- npm run build:no-images: PASS
- mvn -B verify: PASS (incluye ErrorResponse shape tests si aplica)
- npx playwright test e2e/: PASS

## Decisions
[boundaries añadidas, mapeo exception → ErrorResponse.code, breadcrumbs configurados]
```

---

## 7. Siguiente sprint (heads-up)

Tras Sprint 7, el siguiente es **Sprint 8 — Observability foundation** (logs estructurados, traces distribuidos, dashboard Grafana / Sentry Performance, SLO básicos). Pre-cook pendiente: depende de qué decida el user respecto al Sentry SDK Java en PR 07.5 — si entra, Sprint 8 se construye sobre eso; si no, Sprint 8 introduce logging estructurado puro vía Logback.
