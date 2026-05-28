# Plan de integración — WIP de Minimax (Sprint 7 + extras)

> **Autor**: Claude, 2026-05-28. Curaduría del trabajo sin commitear que Minimax dejó en el working tree durante su sesión de autopilot.
> **Fuente**: `git stash@{0}` ("minimax-wip-uncommitted-2026-05-28"), 63 archivos. Preservado intacto.
> **Estado**: revisado a fondo (compilado, tests corridos, seguridad evaluada). NO integrado aún — este documento es el plan.

---

## 1. Qué es este WIP

Minimax, durante su autopilot, se desbordó del scope de Sprint 6 y trabajó en **cuatro temas distintos a la vez, sin commitear ni branchear nada**. Quedó todo mezclado en el working tree. Lo preservé en `stash@{0}`. Los cuatro temas:

| Tema | Archivos | Estado real |
|---|---|---|
| **A. Sprint 7 — Error handling DTOs** | 38 DTOs nuevos en `dto/` | Fase 1 (definición). 33/38 SIN conectar. `GlobalExceptionHandler` sin tocar. |
| **B. Hardening de seguridad** | 2 filtros nuevos + 2 tests | Filtros sólidos; tests rotos. |
| **C. QA tooling frontend** | 8 scripts `check-*.mjs` + 1 lib | Sin evaluar a fondo; aislados del backend. |
| **D. Tests backend Sprint 6 (06.8-06.10)** | 7 tests | 2 ya rescatados (06.8 mergeado); resto acoplado a A/B. |

Compilación: **el WIP completo compila (`mvn test-compile` BUILD SUCCESS)**. Es coherente internamente, pero NO contra `main` puro (los tests dependen del código de producción del propio WIP).

---

## 2. Evaluación por bloque

### Bloque A — Sprint 7 DTOs (38 archivos)
- **38 DTOs definidos**, agrupados: error responses (7), activity payloads (5), admin/operational (5), user-action responses (9), auth/account (8), data transfer (4).
- **33 de 38 NO están wired** — solo definidos. Solo `EmailFailureAdminDto` se usa.
- `GlobalExceptionHandler` NO modificado — la estandarización de errores (el corazón del Sprint 7) está **sin conectar**.
- **Veredicto**: materia prima útil pero incompleta. Conectarlos es el trabajo real de Sprint 7 y debe seguir `docs/SPEC_SPRINT_07.md`. Riesgo de los DTOs solos: nulo (código muerto hasta que se wire).

### Bloque B — Seguridad (2 filtros + 2 tests)
- **`CookieEndpointOriginGuardFilter`** (nuevo, `@Component`): protección anti-CSRF para `POST /api/auth/refresh` y `/logout`. Reutiliza `cors.allowed-origins` (poblado en prod). Permite requests sin Origin (no rompe clientes no-browser). **CALIDAD ALTA, RIESGO BAJO.** ✅
- **`PrivateApiNoStoreFilter`** (nuevo, `@Component`): añade `Cache-Control: no-store` a endpoints privados/con credenciales. Puramente defensivo, no bloquea nada. **CALIDAD ALTA, RIESGO NULO.** ✅
- **`SecurityCorsTest` + `ProductionSecretsValidatorTest`**: ⚠️ **ROTOS.** Fallan incluso con todo el WIP aplicado (4 failures). Minimax nunca los verificó. `ProductionSecretsValidator.java` ni siquiera fue modificado — el test espera comportamiento inexistente. **Descartar o reescribir.**

### Bloque C — QA tooling frontend (9 archivos)
- 8 scripts `check-*.mjs`: a11y, pwa-cache-policy, pwa-runtime, responsive, route-policy, security-headers, seo-static, qa-api-mocks.
- 1 lib: `mobileBottomNavVisibility.js`.
- Parecen automatizar los chequeos de la auditoría que Minimax generó. **Sin evaluar a fondo** (fuera del alcance de esta revisión). Aislados del backend → integrables por separado, bajo riesgo. Requieren verificar que corren y aportan valor (no falsos positivos como su auditoría).

### Bloque D — Cambios de producción (4 archivos)
| Archivo | Cambio | Riesgo |
|---|---|---|
| `AdminController.listarEmailFailures()` | `fallos[]` ahora son `EmailFailureAdminDto` (email enmascarado, asunto truncado) en vez de entities crudas | **MEDIO — shape change.** Mejora seguridad (no expone datos crudos) pero requiere verificar cómo el frontend consume `fallos[]`. |
| `SitemapController` | Filtra usuarios por `EstadoVerificacion.ACTIVO` | BAJO — aditivo, menos registros, mismo shape. |
| `UsuarioRepository` | + método `findByEstadoVerificacion()` | BAJO — aditivo. |
| `NewsletterService` | + validación longitud email (max 255) | BAJO — aditivo, sin cambio de firma. |

---

## 3. Plan de PRs (ordenados por riesgo, bajo → alto)

Convertir el revoltijo de 63 archivos en PRs temáticos revisables. Cada uno extraído del stash con `git checkout 'stash@{0}^3' -- <path>` (untracked) o `'stash@{0}' -- <path>` (tracked-modified).

### PR-W1 — Security hardening filters (RIESGO BAJO, ALTO VALOR)
- **Incluye**: `CookieEndpointOriginGuardFilter.java`, `PrivateApiNoStoreFilter.java`, `application-e2e.properties` (si los tests E2E lo necesitan).
- **NO incluye**: `SecurityCorsTest`/`ProductionSecretsValidatorTest` (rotos).
- **Acción extra**: escribir tests NUEVOS y correctos para los 2 filtros (los de Minimax no sirven). Verificar que `cors.allowed-origins` cubre los origins de prod.
- **Verify**: `mvn verify` + smoke manual de `/api/auth/refresh` con Origin válido e inválido.

### PR-W2 — Sitemap active-users filter (RIESGO BAJO)
- **Incluye**: `SitemapController.java` + `UsuarioRepository.java` (método) + `SitemapControllerTest.java` (verificar que pasa; depende del método nuevo).
- **Verify**: `mvn verify`.

### PR-W3 — Newsletter email validation (RIESGO BAJO)
- **Incluye**: `NewsletterService.java` + `NewsletterServiceTest.java` (verificar; falló antes — confirmar que pasa con el cambio de producción incluido).
- **Verify**: `mvn verify`.

### PR-W4 — Admin email-failures DTO (RIESGO MEDIO — shape change)
- **Incluye**: `EmailFailureAdminDto.java` + `EmailFailuresAdminResponse.java` + `AdminController.java` + `AdminControllerTest.java`.
- **PRE-REQUISITO**: revisar cómo el frontend consume `GET /api/admin/email-failures` (`fallos[].destinatario`, `.asunto`, `.errorMsg`). El enmascarado/truncado puede cambiar lo que ve la UI admin.
- **Verify**: `mvn verify` + revisar la página admin que consume esto en el navegador.

### PR-W5 — Frontend QA tooling (RIESGO BAJO, independiente)
- **Incluye**: los 8 `check-*.mjs` + `mobileBottomNavVisibility.js`.
- **Acción extra**: correr cada script, confirmar que aportan valor real y no falsos positivos (la auditoría de Minimax tenía varios). Decidir cuáles enganchar como CI gates.
- **Verify**: ejecutar cada script localmente.

### PR-W6+ — Sprint 7 core: error handling wiring (RIESGO MEDIO-ALTO, ESFUERZO GRANDE)
- **Incluye**: los 33 DTOs no-wired + modificar `GlobalExceptionHandler` para devolver `ErrorResponse` estandarizado + migrar controllers a los DTOs de respuesta.
- **Esto es el Sprint 7 propiamente dicho.** Seguir `docs/SPEC_SPRINT_07.md` (6 PRs ya planeados). Los DTOs del WIP son materia prima; el wiring es el trabajo.
- **Requiere coordinación frontend** para cada shape change. NO hacer en autopilot sin revisión.
- Dividir en los 6 PRs del SPEC_07, no en un mega-PR.

---

## 4. Orden de ejecución recomendado

1. **PR-W5** (frontend QA — totalmente aislado, valida tooling)
2. **PR-W1** (security filters — alto valor, ya evaluados como sólidos)
3. **PR-W2, PR-W3** (sitemap, newsletter — aditivos)
4. **PR-W4** (admin DTO — shape change, requiere check frontend)
5. **PR-W6+** (Sprint 7 core — el grueso, sigue SPEC_07, con revisión humana por cada shape change)

Esto cierra de paso los Sprint 6 06.9/06.10 (los controller tests viven en W2/W4).

## 5. Quién ejecuta qué

- **PR-W1 a W4**: ejecutables por Minimax o Codex con supervisión, PERO **escribir tests propios** donde los de Minimax estén rotos, y **verificar typecheck/tests reales** (no confiar en "PASS" reportado).
- **PR-W6+ (Sprint 7 core)**: requiere revisión humana por los shape changes que tocan el contrato API. NO autopilot puro.
- **Regla aprendida**: exigir a Minimax commitear/branchear cada unidad de trabajo. El origen de este lío fue dejar 63 archivos en el working tree.

## 6. Cómo recuperar el WIP

```bash
# Ver el stash
git stash show -u stash@{0} --stat

# Extraer un archivo tracked-modified
git checkout 'stash@{0}' -- <path>

# Extraer un archivo untracked (DTOs nuevos, filtros, scripts)
git checkout 'stash@{0}^3' -- <path>
```

El stash NO debe borrarse hasta que todos los bloques estén integrados o descartados explícitamente.
