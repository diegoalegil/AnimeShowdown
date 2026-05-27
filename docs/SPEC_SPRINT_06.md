# SPEC — Sprint Auto 06 (Test coverage 70%)

> **Status**: pre-cocinado por Claude el 2026-05-27 mientras Codex está sin tokens.
> **Branch**: `sprint-auto-06-coverage`.
> **Estimated PRs**: 12 (alineado con backlog 10-12).
> **Goal mínimo**: frontend Vitest a 70% lines / 60% branches sobre `frontend/src/lib/*` y helpers puros; backend JaCoCo a 65% lines / 50% branches en `service.*` con `haltOnFailure=true`.
> **Non-negotiables**: no romper E2E existente (26 tests), no degradar Playwright production build, no inventar DTOs incompletos, no tocar archivos intocables (V1-V29 migrations, cacheNames v3, `PrometheusScrapeAuthFilter.java`, i18n `detection.order ['localStorage']`, refresh cookie SameSite=Lax, playwright retries: 2).

---

## 1. Estado actual (inventario realizado 2026-05-27)

### Frontend
- **Unit tests: 0.** No hay Vitest instalado, no hay `vitest.config.*`, no hay scripts `test` / `coverage` en `package.json` (solo Playwright).
- `frontend/src/lib/*.ts` — 8 archivos TypeScript estricto sin ningún `.test.ts`:
  | Archivo | LOC | Riesgo |
  |---|---|---|
  | `api.ts` | 769 | crítico — tokens, refresh, abort, ApiError |
  | `personajes-core.ts` | 252 | crítico — catalog, slugs, stats |
  | `games.ts` | 233 | medio — daily picks, storage |
  | `localVoteRanking.ts` | 208 | medio — votos locales, filtros |
  | `torneosQueries.ts` | 135 | medio — query builders |
  | `queryClient.ts` | 62 | bajo — React Query setup |
  | `share.ts` | 42 | bajo — URLs share |
  | `types.ts` | 25 | bajo — solo tipos |
- **Total `src/`**: 263 archivos `.ts/.tsx/.js/.jsx`.

### Backend
- **39 tests JUnit existentes** (17 controllers + 8 services + 6 security + 2 models + helpers).
- JaCoCo 0.8.12 configurado en `backend/pom.xml` con `haltOnFailure=false` (warning-only) y rule mínima 50% LINE sobre `com.diegoalegil.animeshowdown.service*`.
- **Services sin test (peso alto)**:
  | Service | LOC aprox | Por qué urge |
  |---|---|---|
  | `TorneoService` | 425 | bracket logic, lifecycle |
  | `PerfilService` | 326 | mutations, stats rollup |
  | `PrediccionService` | 228 | ELO weighting, predicciones |
  | `RecomendacionService` | ~150 | feed recomendaciones |
  | `BracketService` + `BracketAdvanceService` | ~200 | avance torneo |
- **Controllers sin test**: `AdminController`, `AdminTorneoController`, `AdminAssetController`, `AutoTorneoController`, `CronTorneoController`, `DueloLiveController`, `DueloLiveWsController`, `PersonajeController`, `SitemapController`.

### E2E
- 7 specs / 26 tests en `frontend/e2e/` (a11y, home flows, auth básico, voto+ranking sync, duel-live happy path, home-responsive, critical-state).
- Browsers: chromium-desktop 1366x900 + chromium-mobile Pixel 7. Retries CI=2, local=0.

---

## 2. Plan de 12 PRs (orden barato → caro)

> Cada PR debe ser merge-able solo, pasar CI verde, y NO bajar la cobertura ya existente. Si un PR no llega a la meta de su fase, abrir issue separado y seguir con el siguiente.

### Fase 1 — Setup infra (1 PR)

#### PR 06.1 — Install Vitest + tighten JaCoCo
- **Branch**: `sprint-auto-06-coverage` (los siguientes PRs encadenan desde aquí).
- **Frontend**:
  - Instalar `vitest@^2`, `@vitest/coverage-v8`, `@testing-library/react@^16`, `@testing-library/jest-dom`, `happy-dom`.
  - Crear `frontend/vitest.config.js` con `environment: 'happy-dom'`, `setupFiles: ['./src/test/setup.ts']`, `coverage.provider: 'v8'`, `coverage.reporter: ['text','json','html','lcov']`, `coverage.thresholds: { lines: 30, branches: 25 }` (umbral bajo en este PR; sube en cada fase).
  - Crear `src/test/setup.ts` con `import '@testing-library/jest-dom/vitest'`.
  - Añadir scripts a `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"`.
  - Smoke test mínimo: `src/lib/types.test.ts` validando re-exports.
- **Backend**:
  - `pom.xml` → `jacoco:check` rule sube a 50% LINE / 40% BRANCH y `haltOnFailure=true` solo en CI (no en local dev). Si rompe, este PR explica por qué.
  - Si rompe, divide: este PR solo añade el reporte, y `haltOnFailure=true` queda para PR 06.10.
- **CI workflow**: añadir paso `npm test -- --coverage --run` antes de build. Subir artifact `coverage/` para inspección.
- **Verify**:
  - `npm test` PASS
  - `npm run test:coverage` PASS
  - `mvn -B test jacoco:report` PASS local
  - CI verde
- **Esperado**: 0% → ~5% (solo el smoke test de types). El valor de este PR es la infra.

### Fase 2 — Frontend lib tests (4 PRs)

> Regla: cada test es **unitario puro**. No render React (eso es para Fase 5). Mock `fetch` con `vi.spyOn(global, 'fetch')`. Mock `localStorage` con `vi.stubGlobal('localStorage', ...)`. Mock `Date.now()` con `vi.useFakeTimers()` cuando aplique.

#### PR 06.2 — Tests para libs simples (`share`, `queryClient`, `types`)
- **Files**: `src/lib/share.test.ts`, `src/lib/queryClient.test.ts`.
- **Cobertura objetivo**:
  - `share.ts`: 100% lines (es <50 LOC). Test build de URLs, deeplinks, fallback navigator.share, copy-to-clipboard.
  - `queryClient.ts`: 90%+. Test defaults, retry policy, staleTime.
- **Esperado**: cobertura global ~10%.

#### PR 06.3 — Tests para storage local (`localVoteRanking`, `games`)
- **Files**: `src/lib/localVoteRanking.test.ts`, `src/lib/games.test.ts`.
- **Casos críticos**:
  - `localVoteRanking`: registro de voto, filtrado por periodo (`daily`/`weekly`/`monthly`), stats agregadas, limpieza de storage corrupto, dedup por slug + timestamp.
  - `games`: daily pick determinismo por fecha, reset de medianoche, recovery cuando `localStorage` está sucio, `getDailyResetCountdown`.
- **Esperado**: cobertura global ~25%.

#### PR 06.4 — Tests para catálogo (`personajes-core`, `torneosQueries`)
- **Files**: `src/lib/personajes-core.test.ts`, `src/lib/torneosQueries.test.ts`.
- **Casos críticos**:
  - `personajes-core`: hidratación con `personajes-overrides.json`, alias matching case-insensitive, slug canonicalization, stats sintéticas, top ELO computation, edge case roster vacío.
  - `torneosQueries`: query keys estables, filtros opcionales, paginación.
- **Fixtures**: crear `src/test/fixtures/personajes.fixture.ts` con 5-10 personajes representativos para no depender del JSON real (~1086 personajes haría tests lentos).
- **Esperado**: cobertura global ~45%.

#### PR 06.5 — Tests para `api.ts` (el más complejo)
- **Files**: `src/lib/api.test.ts`.
- **Casos críticos** (split en describe blocks por endpoint family):
  - Token: set / clear / read in-memory + listeners (event emitter pattern).
  - Refresh: 401 → refresh → retry con backoff. Falla refresh → logout.
  - Abort: AbortSignal propagado, timeout default, cleanup.
  - ApiError: status, body parsing, retryAfter header.
  - Endpoints flexibles: personajes, votar, torneos, perfil, login, refresh, logout. Test request shape, NO el contenido.
  - CSRF / Origin header inclusion según endpoint.
- **Mocks**: `vi.spyOn(global, 'fetch')` para todos. `vi.useFakeTimers()` para timeout/retry.
- **Esperado**: cobertura global ~70%. Frontend coverage meta cumplida.
- **Cobertura threshold a subir en `vitest.config.js`**: `lines: 70, branches: 60`.

### Fase 3 — Backend service tests (3 PRs)

> Regla: usar `@SpringBootTest` solo si el service depende de Spring context (DB, beans). Para lógica pura usar JUnit5 vanilla con mocks Mockito. Cada PR debe mantener JaCoCo verde.

#### PR 06.6 — `PrediccionService` + `RecomendacionService`
- **Files**: `backend/src/test/java/.../service/PrediccionServiceTest.java`, `RecomendacionServiceTest.java`.
- **Casos críticos**:
  - Predicción ELO: cálculo de probabilidad por diferencia, ajuste por género (female boost si está activo), edge case empate.
  - Recomendaciones: feed personalizado por historial, fallback cuando no hay historial, dedup contra ya votados.
- **Sin DB**: mock `PersonajeRepository`, `VotoRepository`. Mockito.

#### PR 06.7 — `TorneoService` (split en partes)
- **Files**: `TorneoServiceTest.java` con secciones:
  - `lifecycle` — crear, abrir, cerrar, archivar.
  - `bracket` — generación bracket inicial, sembrado por ELO.
  - `advance` — avance de ronda, byes, ganador final.
- **Por qué es el PR más grande**: 425 LOC implementación; espera 250-350 LOC test.
- **Cobertura meta**: ≥75% lines del service.

#### PR 06.8 — `PerfilService` + `BracketAdvanceService`
- **Files**: `PerfilServiceTest.java`, `BracketAdvanceServiceTest.java`.
- **PerfilService casos críticos**:
  - Mutations: cambiar username (con validación slug), bio, avatar.
  - Stats rollup: votos por periodo, badges desbloqueadas, racha.
  - Audit log integration: cada mutation registra `AuditEvento` (chequear con captor Mockito).
- **BracketAdvanceService casos críticos**:
  - Avance de ronda con par de competidores válidos.
  - Manejo de byes.
  - No avanza si ronda incompleta.

### Fase 4 — Backend controller tests (2 PRs)

> Regla: usar `@WebMvcTest(NombreController.class)` + `MockMvc`. Mock services con `@MockBean`. Cubrir happy + 400 + 401/403 + 404 + 500 por cada endpoint.

#### PR 06.9 — Admin controllers
- **Files**: `AdminControllerTest.java`, `AdminTorneoControllerTest.java`, `AdminAssetControllerTest.java`.
- **Casos críticos**:
  - Cada endpoint admin requiere `@PreAuthorize` o equivalente — test que devuelve 403 sin role admin.
  - Mutations admin generan `AuditEvento` (verificar via captor).
  - Validation de payload (400 cuando malo).

#### PR 06.10 — Public + auto controllers + JaCoCo hard gate
- **Files**: `PersonajeControllerTest.java`, `AutoTorneoControllerTest.java`, `CronTorneoControllerTest.java`, `SitemapControllerTest.java`.
- **Casos críticos**:
  - PersonajeController: GET by slug, GET search, 404 cuando no existe.
  - AutoTorneo: cron trigger crea torneo automático.
  - CronTorneo: trigger manual hace lo mismo y emite audit.
  - Sitemap: XML válido, lastmod actualizado.
- **Final del PR**: subir JaCoCo rule a 65% LINE / 50% BRANCH `service.*` con `haltOnFailure=true`. CI debe ser verde con esta config — si no llega, este PR no merge, ajustar fases anteriores.

### Fase 5 — E2E expansion (2 PRs)

> Regla: NO duplicar lo que cubre unit. E2E para flows multi-paso de UX que cruzan múltiples páginas + estado persistente.

#### PR 06.11 — E2E tournament lifecycle
- **File**: `frontend/e2e/tournament-lifecycle.spec.js`.
- **Flow**: admin crea torneo → asigna competidores → publica → usuario vota → admin avanza bracket → final → resultado se refleja en perfil del ganador.
- **Mock backend**: usar `page.route()` para interceptar fetch y devolver fixtures determinísticas. NO depender de backend real (eso es para integration test, no E2E).

#### PR 06.12 — E2E auth + 2FA
- **File**: `frontend/e2e/auth-twofa.spec.js`.
- **Flow**:
  - Setup: usuario activa TOTP en `/perfil/seguridad`, genera secret + QR, valida con código.
  - Backup codes: descarga, usa uno para re-auth.
  - Logout + re-login con TOTP requerido.
  - Edge: código TOTP malo → 401, código expirado → 401, usuario sin 2FA login normal.
- **No tocar**: `PrometheusScrapeAuthFilter.java`, refresh cookie SameSite=Lax — solo cubrir el flow user-facing.

---

## 3. Coverage gates finales

| Capa | Métrica | Antes Sprint 6 | Tras Sprint 6 |
|---|---|---|---|
| Frontend lines | Vitest | 0% | 70% |
| Frontend branches | Vitest | 0% | 60% |
| Backend lines (service.*) | JaCoCo | warning 50% | hard 65% |
| Backend branches (service.*) | JaCoCo | n/a | hard 50% |
| E2E specs | Playwright | 7 specs / 26 tests | 9 specs / ~35 tests |

Si una métrica no llega, **NO se baja el threshold para forzar verde** — abrir issue + seguir con el siguiente PR. El threshold se baja solo si el SPEC entero detecta que era irreal.

---

## 4. Heads-up para Codex

- **Vitest no está instalado** — PR 06.1 instala todo. Hasta entonces `npm test` no existe.
- **JaCoCo está en warning-only** ahora. Subir gradualmente para no romper PRs concurrentes.
- **Fixtures**: crear `frontend/src/test/fixtures/` para personajes/torneos/perfiles. NO importar el JSON real (1086 personajes, lentitud).
- **AuditEvento**: PR #122 (Sprint 5) ya añadió audit log para mutaciones admin. Los tests del PR 06.9 DEBEN verificar que el audit se emite (captor Mockito).
- **Co-Authored-By**: solo en branches, nunca en main (AGENTS.md §1).
- **Direct-push a main**: autorizado para cualquier `docs(progress)` + PRs con CI verde. Sin `--no-verify`.
- **Si un test es flaky**: marcar `test.fixme` o `it.skip` con comentario explicando + abrir issue. Nunca borrar el test.
- **No tocar**:
  - `db/migration/V1-V29_*.sql` (Flyway baseline)
  - `cacheNames v3` en `frontend/src/lib/cacheNames.ts` (PWA bumping rules)
  - `PrometheusScrapeAuthFilter.java` (filtro de auth metrics)
  - i18n `detection.order: ['localStorage']` (locked decision)
  - refresh cookie `SameSite=Lax` (locked)
  - playwright `retries: 2` en CI (no subir ni bajar)

---

## 5. Qué evitar

- ❌ Snapshot tests salvo para componentes 100% estables sin animaciones ni randomness. **El visual system está vivo aún**, snapshots se romperían cada sprint.
- ❌ Tests que dependan de fechas reales — usa `vi.useFakeTimers()` y `vi.setSystemTime()`.
- ❌ Tests que dependan de red real — todos los `fetch` mockeados.
- ❌ Refactor de código de producción para "facilitar tests". Si no se puede testear, anotar issue y mover. **El Sprint 6 añade tests, no refactoriza**.
- ❌ Tests E2E que cubran lo que ya cubre Vitest. E2E es solo multi-step UX.
- ❌ `it.skip` permanente sin issue tracker. Cada skip = un TODO trackeado.
- ❌ Tocar tests existentes (los 39 backend + 26 E2E) salvo para arreglar flakiness o adaptar a cambios API. **Los tests verdes son sagrados**.

---

## 6. Verify checklist por cada PR

Antes de marcar un PR como ready:

```bash
# Frontend
cd frontend
npm run lint
npm run typecheck          # debe seguir verde sobre lib/* TS estricto
npm test                   # nuevo desde PR 06.1
npm run test:coverage      # debe subir vs PR anterior
npm run build:no-images    # bundle sigue dentro del budget

# Backend
cd backend
mvn -B test                # JaCoCo report generado
mvn -B verify              # con jacoco:check si haltOnFailure=true

# E2E
cd frontend
npx playwright test e2e/   # los 26 existentes + nuevos

# Git
git diff --check           # whitespace clean
```

Y en el PR description:

```markdown
## Resumen
Sprint Auto 06 — PR 06.X de 12.

## Verify
- node --version: v22.22.2
- npm run lint: PASS
- npm run typecheck: PASS
- npm test: PASS (X new tests, Y total)
- npm run test:coverage: lines X%, branches Y% (PR anterior: lines A%, branches B%)
- npm run build:no-images: PASS
- mvn -B verify: PASS (JaCoCo: lines X%, branches Y%)
- npx playwright test e2e/: PASS (26 + N new)

## Decisions
[fixtures usadas, mocks aplicados, edge cases descartados con razón]
```

---

## 7. Siguiente sprint pre-cocinado (heads-up)

Tras Sprint 6, el siguiente es **Sprint 7 — Error handling + boundaries granular** (5-7 PRs). Pre-cook pendiente. Antes de arrancar Sprint 7, leer el resumen del Sprint 6 cierre en `PROGRESS.md` para confirmar que la base de coverage es estable.
