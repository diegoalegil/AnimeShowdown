# BACKLOG_AUTOPILOT.md — 40 sprints / 48h modo full auto

> **Lee primero `AGENTS.md`** — convenciones permanentes. Si algo aquí contradice `AGENTS.md`, AGENTS gana.
> **Este backlog es para autopilot multi-sprint de larga duración.** El `BACKLOG.md` original (sprints 0-8) tiene prioridad si aún no está cerrado.

---

## Misión

Completar 40 sprints temáticos en aproximadamente **48 horas de autopilot continuo** sin pausa entre sprints. Estimación: **150-220 PRs totales**.

## Modo de operación

- Trabajar sprint por sprint en orden numérico. Si un sprint se queda sin contenido aplicable (porque ya estaba hecho), marcarlo DONE en `PROGRESS.md` y saltar al siguiente.
- Cada sprint = 1 rama `sprint-auto-NN-<tema>` desde `main` actualizado.
- PRs dentro del sprint pueden ir directos a la rama del sprint o usar sub-ramas `sprint-auto-NN-<tema>/<pr-tema>`.
- Auto-merge **a `main`** autorizado con CI verde (AGENTS.md §9 vigente).
- Conventional Commits expandido (AGENTS.md §1).
- Verificación obligatoria pre-commit (AGENTS.md §8).
- Actualizar `PROGRESS.md` tras cada PR mergeado.

## Reglas críticas (recordatorio rápido)

❌ NUNCA `Co-Authored-By` en commits que llegan a `main`.
❌ NUNCA `git push --force` a `main`.
❌ NUNCA `git reset --hard` sin OK humano explícito.
❌ NUNCA `--no-verify` para skipear hooks.
❌ NUNCA llamadas a APIs de generación de imágenes desde el código.
❌ NUNCA tocar archivos intocables (V1-V29 migrations, cacheNames v3, PrometheusScrapeAuthFilter, i18n detection.order, refresh cookie SameSite, playwright retries: 2).
⏸️ Parar y reportar si: nuevo coste mensual aparece, cambio de seguridad/auth no listado en sprint, contradice explícitamente AGENTS.md / BACKLOG.md original.

---

# TIER S — Foundational (sprints 1-8)

## Sprint 1 — Performance LCP + bundle budget

**Goal:** llevar LCP < 2.0s en desktop, < 2.5s en mobile (móvil 4G simulado). Bundle JS inicial < 220 KB gzip.

**Scope:**
- Audit con Lighthouse + WebPageTest en `/`, `/personajes`, `/animes`, `/votar`, `/ranking`, `/torneos`, `/games`.
- Lazy-load de componentes pesados (`personaje3d` ya separado, revisar otros chunks).
- Preconnect/dns-prefetch a R2 CDN.
- Inline critical CSS (ya con beasties, revisar cobertura).
- Defer scripts no críticos.
- Optimizar fonts (font-display: swap, subset).
- Reducir CLS de imágenes (width/height explícitos).
- `frontend/scripts/check-bundle-budget.mjs` debe pasar como CI gate.

**Estimated PRs:** 6-8.
**Branch:** `sprint-auto-01-perf-lcp`.
**Qué evitar:** quitar features visibles para mejorar números. Si una optimización rompe UX, descartar.

## Sprint 2 — Accessibility WCAG 2.2 AA estricto

**Goal:** todas las páginas pasan axe-core sin violaciones de nivel A o AA.

**Scope:**
- Audit con axe DevTools en cada ruta principal.
- Contraste mínimo 4.5:1 en texto, 3:1 en UI grande.
- Roles ARIA correctos en menús, dialogs, tablists.
- Focus visible en todos los interactivos (outline o ring claro).
- Keyboard navigation completa (tab order lógico, Esc cierra modales).
- Skip-to-content link.
- prefers-reduced-motion respetado en todas las animaciones.
- Alt text descriptivo en imágenes de contenido (no decorativas).
- aria-live para toasts/notifications.

**Estimated PRs:** 8-10.
**Branch:** `sprint-auto-02-a11y-wcag-aa`.
**Tests:** añadir `npm run test:a11y` con axe-core en e2e si no existe.

## Sprint 3 — Mobile responsive deep audit

**Goal:** cero overflow horizontal en 320/360/390/430/768/1024/1280/1440/1920. Touch targets ≥ 44×44.

**Scope:**
- Expandir guardrail existente (`home-responsive.spec.js`) a todas las páginas.
- Revisar componentes problemáticos: brackets, tablas, cards muy densas.
- Bottom navigation review en mobile.
- Safe-area-inset para iOS.
- Pull-to-refresh donde tenga sentido.
- Swipe gestures en carruseles/galerías.

**Estimated PRs:** 5-7.
**Branch:** `sprint-auto-03-mobile-deep`.

# 🚨 PRIORITARIO — Stability + Cleanup + Pro Pass (sprints 3.5a, 3.5b, 3.5c)

**Heads-up del humano (orden directa):** tras completar Sprint 3, Codex SALTA inmediatamente a los sprints 3.5a → 3.5b → 3.5c. Estos cubren un macro-informe de auditoría del frontend completo (bugs reales que rompen UX, deuda técnica, prep portfolio). Tras terminar 3.5c, Codex continúa con Sprint 4 (SEO) y el resto del autopilot normalmente.

Source: macro informe del humano. Diagnóstico completo: producto serio con identidad, pero crecido lo suficiente para necesitar pasada de estabilidad antes de seguir añadiendo features. No saltarse esta pasada.

---

## Sprint 3.5a — STABILITY PASS (12 críticos + 8 importantes)

**Goal:** arreglar los bugs reales identificados en la auditoría que rompen UX hoy. No es opcional. CI verde en cada PR.

**Branch raíz:** `sprint-auto-3.5a-stability-pass`.
**Estimated PRs:** 15-18.

### 12 CRÍTICOS (atacar primero)

1. **`api.js` timeout + signal externo**: si el caller pasa un `AbortController` externo, el `timeoutMs` interno puede quedar anulado. Crear helper `createRequestSignal({ signal, timeoutMs })` que combine ambos abort signals.
2. **`api.js` `votosPeriodoBatch` con `slugs` undefined**: `slugs.filter(Boolean)` peta si `slugs` viene undefined. Default `{ slugs = [], dias = 7 } = {}` + guard `Array.isArray`. Aplicar también a la queryKey en `queryClient`.
3. **StrictMode double calls en `VerifyPage`, `NewsletterConfirmarPage`, `Modal2faSetup`**: useEffect ejecuta 2x en dev, consumiendo el token la primera vez y mostrando error la segunda. Usar `useRef` guardia (`startedRef`).
4. **`VotarPage` duelo fijo se pierde al siguiente voto**: `/votar?personaje=luffy&rival=naruto` muestra el primer duelo correcto, pero al pulsar "siguiente" cae a duelo random aunque la URL siga diciendo Luffy. Mantener el personaje fijo en `nextPair` cuando `fixedPersonaje` exista.
5. **`VotarPage` captcha pierde metadatos**: el flujo de captcha reconstruye un objeto pobre con solo slug/nombre, perdiendo anime/rival/metadatos. Guardar objetos completos dentro del `captchaChallenge`.
6. **Bracket predicciones cache por usuario**: queryKey `['predicciones', 'mias', torneoId]` puede leak entre usuarios. Incluir `user?.id` en la queryKey.
7. **`PersonajeImg` / `PersonajeCutImg` handlers sobrescribibles**: si el caller pasa `onError`/`onLoad`, sobrescribe los handlers internos. Combinarlos: llamar internal primero y luego `imgProps.onError?.(event)`.
8. **`PersonajeCutImg` `failed` no se resetea al cambiar slug**: `useEffect(() => setFailed(false), [slug])`.
9. **`useCatalogoPersonajes` staleTime Infinity**: initialData desde localStorage + staleTime Infinity → usuarios podrían no recibir personajes nuevos hasta limpiar caché. Cambiar a `staleTime: 60 * 1000` + `refetchOnMount: true`. Quitar `syncCatalogoPersonajes(query.data)` durante render — solo dentro de useEffect.
10. **`NotifBell` / `useUnreadCount` no recibe WS si dropdown cerrado**: badge tarda en actualizar. Hacer que `useUnreadCount` escuche `/user/queue/notificaciones` y invalide `KEY_UNREAD` + `KEY_LIST_BASE` al recibir mensaje.
11. **`CardMiRoster` button dentro de Link**: HTML interactivo anidado inválido. Sacar el button del Link, posicionarlo `absolute` con `pointer-events` correcto.
12. **`SectionPulso` duelo mostrado vs duelo random al hacer click**: la card muestra A vs B pero el CTA va a `/votar` random. Link debe ser `/votar?personaje=${a.slug}&rival=${b.slug}`.

### 8 IMPORTANTES (atacar después de los críticos)

13. **SEO 404 durante carga**: `useSeo` muestra "404 — No encontrado" mientras `data` está loading. Distinguir `isLoading` → "Cargando..." + noindex temporal. Aplicar en `AnimeDetailPage`, `AnimeRankingPage`, `TorneoDetailPage`, `PersonajeDetailPage`.
14. **`RankingPage` tabs en URL**: tab actual no se sincroniza con query params. Crear hook `useQueryState(key, defaultValue)` reusable.
15. **`PersonajesPage` búsqueda en URL**: `q` no se sincroniza con query params. Mismo hook `useQueryState`.
16. **i18n: japonés activo pero textos hardcoded + falta hreflang ja**: `useSeo` debería emitir hreflang `ja`. Migrar al menos Hero/Header/Footer/MobileNav/Hero.
17. **Fechas inválidas centralizadas**: helper `parseDateSafe` + `formatRelativeSafe` (validar `Number.isNaN(getTime())`). Aplicar en `HistorialCompetitivo`, `NotifBell`, `SectionPulso`, `StatusPage`, `TorneoDetailPage`, `EloHistoryChart`.
18. **Empty states que no limpian filtros**: añadir botón "Limpiar filtros" a los EmptyState que aparecen tras filtrar.
19. **Legal sin email/nombre personal**: cambiar a `contacto@animeshowdown.dev`. Mover datos de proveedores a config separada. Alinear claims legales con implementación real (JWT en memoria + cookie refresh, no localStorage).
20. **`Footer` no debería cargar catálogo en todas las rutas**: actualmente carga personajes globales para mostrar top animes. Lazy load o solo en rutas relevantes (home/about).

**Qué evitar:**
- Saltarse cualquiera de los 12 críticos por "no parece urgente". El humano los validó como bugs reales que afectan UX.
- Cambios masivos de refactor en este sprint. Aquí solo bugfixes quirúrgicos. El refactor va en 3.5b.

---

## Sprint 3.5b — CLEANUP PASS (refactor + helpers + unificación)

**Goal:** reducir deuda técnica acumulada. Dividir páginas enormes, crear helpers reusables, unificar componentes duplicados.

**Branch raíz:** `sprint-auto-3.5b-cleanup-pass`.
**Estimated PRs:** 10-12.

**Scope:**

### Refactor de páginas enormes (5-7 PRs)

Migrar a estructura `src/features/<feature>/` con `hooks/` + `components/` separados:

- **`VotarPage.jsx` (~1500 LOC)** → `features/votar/`: extraer `useVotePair`, `useVoteSessionStats`, `useCaptchaVoteFlow`, `useVoteKeyboardShortcuts`. Componentes: `VoteCard`, `VoteControls`, `SessionRecap`.
- **`RankingPage.jsx` (~1600 LOC)** → `features/ranking/`: `RankingTabs`, `RankingTable`, `RankingMetaReport`, `RankingPodium`.
- **`PersonajeDetailPage.jsx` (~1000 LOC)** → `features/personajes/`: `PersonajeHero`, `PersonajeStats`, `PersonajeGallery`, `HistorialCompetitivo` (ya existe, mover).
- **`PersonajesPage.jsx` (~1000 LOC)** → `features/personajes/CatalogoPersonajes/`.
- **`SectionPulso.jsx` (~1000 LOC)** → split por bloque (DueloDestacado, MoversCard, EventoCard, RetoDelDia, TorneoActivoCard, DuelosPendientes, UltimosVotos).
- **`PerfilPage.jsx` (~900 LOC)** + **`AdminPage.jsx` (~800 LOC)** + **`GamesHubPage.jsx` (~700 LOC)** + **`MiTop5Page.jsx` (~700 LOC)** + **`AnimeDetailPage.jsx` (~600 LOC)** → split similar.

### Helpers + hooks reusables (2-3 PRs)

- `lib/dateUtils.js`: `parseDateSafe`, `formatRelativeSafe`, `formatAbsoluteSafe`.
- `hooks/useQueryState.js`: sincronización URL ↔ estado para tabs, filtros, búsqueda.
- `lib/shareWithToast.js`: factorizar el patrón native share + clipboard fallback + toast (actualmente duplicado en cada game daily).
- `hooks/useDailyGameState.js` + `useTodayKey`: hook canónico que rebota cuando cruza medianoche.
- `lib/buildUrl.js`: builder de URLs con `encodeURIComponent` automático (resolver inconsistencias actuales).

### Unificaciones (2-3 PRs)

- **Modales/dialogs**: unificar `AccessibleDialog` + variantes ad-hoc en `<Dialog>` única con focus trap, ESC close, scroll lock, `aria-labelledby` auto.
- **`EmptyState` vs `EmptyStateScene`**: APIs distintas, mismo propósito. Consolidar en una sola con prop `scene` opcional.
- **Mover datos hardcodeados a config**: emails, URLs, social handles, proveedores → `frontend/src/data/config.js` o env vars.

**Qué evitar:**
- Tocar lógica de negocio durante el refactor. Mismo comportamiento, distinta estructura.
- Renombrar archivos sin actualizar todos los imports (eslint-plugin-import debe quedar verde).
- Romper las queryKeys actuales (los caches en uso deben seguir hits hasta que se vacíen naturalmente).

---

## Sprint 3.5c — PRO PASS (TS lib/* + tests + asset dashboard + README portfolio)

**Goal:** dejar el proyecto presentable como portfolio premium. TypeScript en los archivos críticos de lib/, tests E2E de los flujos que el informe identifica como críticos, dashboard admin de assets, README brutal con screenshots.

**Branch raíz:** `sprint-auto-3.5c-pro-pass`.
**Estimated PRs:** 7-9.

**Scope:**

### TypeScript en `lib/*` críticos (2-3 PRs)

Migrar solo estos 7 archivos (sin tocar componentes ni páginas, por scope):

- `lib/api.js` → `api.ts`
- `lib/queryClient.js` → `queryClient.ts`
- `lib/personajes-core.js` → `personajes-core.ts`
- `lib/localVoteRanking.js` → `localVoteRanking.ts`
- `lib/games.js` → `games.ts`
- `lib/torneosQueries.js` → `torneosQueries.ts`
- `lib/share.js` → `share.ts`

Configurar `tsconfig.json` con `allowJs: true` + `strict: true` solo para estos archivos. Types compartidos en `lib/types.ts`.

### Tests E2E críticos (3-4 PRs)

Playwright tests para los flujos identificados como críticos:

1. Usuario entra, vota, ranking local cambia.
2. `/votar?personaje=a&rival=b` muestra ese duelo exacto y el siguiente sigue girando alrededor del fijo.
3. Login con `next` vuelve a la ruta original tras éxito.
4. `RankingPage` tab cambia URL y al recargar mantiene el tab.
5. `PersonajesPage` búsqueda persiste en URL.
6. Verify page no llama 2x en StrictMode (test en build production donde StrictMode está off — pero el guard de useRef debe pasar igualmente).
7. Notificación WS aumenta badge sin abrir dropdown.
8. Mobile nav no tapa contenido final (regresión Sprint 3).
9. Reduced motion desactiva animaciones clave.
10. Favorito se actualiza optimistic y rollback si falla.
11. MiTop5 con `?add=slug` añade slot aunque la página ya esté montada.

### Asset health dashboard (1 PR)

Ruta `/admin/assets` (gated por auth admin):

- Listado de fallbacks por tipo (cuts, banners, SSR, brand).
- Imágenes con 404 reportados por `asset-tracking.js`.
- Slugs sin cut.
- Visuales missing en `visual-assets-manifest.js`.
- Últimos errores tracked.
- Botón "Copiar reporte" como markdown.

### README portfolio + Lighthouse checklist (1-2 PRs)

- `README.md` rewrite siguiendo la estructura del informe (Stack / Features / Arquitectura / Performance / Testing / Screenshots).
- Generar `docs/screenshots/` con capturas de home, votar, ranking, personaje, torneo, games, perfil, modo TV.
- Sección "Performance budget" con resultados Lighthouse 4 categorías ≥ 90.
- Badges de CI/coverage/version.
- `docs/DEMO.md` con video o GIF de los flujos clave.

**Qué evitar:**
- TS migration de componentes o páginas (fuera de scope para 3.5c — eso es Sprint 39 i18n + futuro).
- README con marketing genérico. Que cuente la decisión técnica + qué problemas resuelve.
- Screenshots con datos de usuario real. Usar fixtures.

---

## Sprint 4 — SEO structured data exhaustivo

**Goal:** Schema.org JSON-LD completo en todas las entidades (CreativeWork, Person, Event, SportsEvent, BreadcrumbList).

**Scope:**
- AnimeDetailPage: `CreativeWork` + `TVSeries`.
- PersonajeDetailPage: `Person` (fictional).
- TorneoDetailPage: `Event` / `SportsEvent`.
- Eventos: `Event`.
- BreadcrumbList en todas las páginas de detalle.
- FAQ schema en `/llms.txt` page (si existe).
- Validar con Rich Results Test.
- Sitemap segmentado por tipo si crece mucho.

**Estimated PRs:** 6-8.
**Branch:** `sprint-auto-04-seo-structured`.

## Sprint 5 — Security audit + headers tightening

**Goal:** A+ en securityheaders.com, A+ en SSL Labs, CSP estricto sin `unsafe-inline`.

**Scope:**
- CSP review: nonce/hash en scripts inline restantes.
- COOP, COEP, CORP donde aplique.
- Subresource Integrity en CDN externos.
- HSTS preload check.
- X-Frame-Options: DENY.
- Permissions-Policy minimal.
- Verificar cookie flags (HttpOnly, Secure, SameSite=Lax para refresh).
- Rate limiting en endpoints sensibles (login, register, password reset).
- Audit log de operaciones admin.

**Estimated PRs:** 5-7.
**Branch:** `sprint-auto-05-security`.
**Heads-up:** este sprint toca seguridad. AGENTS.md §9 dice que cambios de auth/security siguen requiriendo PR + revisión. NO auto-merge en este sprint sin OK del humano.

## Sprint 6 — Test coverage to 70%

**Goal:** frontend Vitest + backend JaCoCo a 70% en líneas / 60% en ramas.

**Scope:**
- Coverage report actual con `npm run test -- --coverage` y `mvn test jacoco:report`.
- Identificar archivos con < 50% y priorizar core (lib/, services/, controllers/).
- Tests unitarios para utilidades pure (formatters, validators, helpers).
- Tests de integración para flows críticos (login, voto, claim torneo).
- Snapshot tests para componentes UI estables.
- E2E expandidos para flujos no cubiertos.

**Estimated PRs:** 10-12.
**Branch:** `sprint-auto-06-coverage`.

## Sprint 7 — Error handling + boundaries granular

**Goal:** ningún flujo crítico muestra error genérico al usuario. Cada error tiene un mensaje accionable.

**Scope:**
- ErrorBoundary granular por sección (no solo top-level).
- 404 → componente custom con sugerencias.
- 500 → mensaje + reintentar + reporte automático.
- Network errors → retry con backoff.
- Optimistic updates con rollback claro.
- Backend: GlobalExceptionHandler exhaustivo, responses estandarizados.

**Estimated PRs:** 5-7.
**Branch:** `sprint-auto-07-errors`.

## Sprint 8 — Observability foundation

**Goal:** poder responder "qué pasó" en minutos cuando algo falla en prod.

**Scope:**
- Frontend: Web Vitals reporting a `/api/metrics` (o stdout si no hay backend).
- Backend: Micrometer + Prometheus endpoint (`/actuator/prometheus`), métricas custom de duels/votes/sessions.
- Logging estructurado JSON con correlation IDs.
- Trace IDs entre frontend y backend.
- Health checks granulares (DB, Redis si aplica, R2).
- Dashboard de runbook básico en docs/.

**Estimated PRs:** 6-8.
**Branch:** `sprint-auto-08-observability`.
**Vetos:** no añadir SaaS de pago (Datadog, NewRelic). Solo OSS o stdout.

---

# TIER A — UX polish (sprints 9-16)

## Sprint 9 — Microinteractions + animation choreography

**Goal:** transiciones fluidas, sensación premium en cada acción.

**Scope:**
- Framer Motion review en componentes clave (Card, Modal, Toast, Drawer).
- Stagger animations en listados.
- Page transitions sutiles.
- Hover/active states refinement.
- Loading-to-loaded transitions sin flash.
- prefers-reduced-motion respetado (sin animación, no transición lenta).

**Estimated PRs:** 4-6.
**Branch:** `sprint-auto-09-microinteractions`.

## Sprint 10 — Loading state choreography + skeleton variants

**Goal:** ninguna pantalla muestra "blanco" durante carga. Skeletons consistentes y con variantes específicas por contexto.

**Scope:**
- Skeleton variants en todas las páginas con fetch.
- Variantes nuevas del primitive: `card-ssr`, `bracket-row`, `ranking-row`, `tournament-card`, `chat-message`.
- Documentación de uso (ampliar `docs/UI_RESILIENCE.md` existente).
- Suspense boundaries donde aplique.
- Progressive loading (priority content first).
- Streaming SSR si está disponible.
- Spinner solo donde Skeleton no aplica.

**Estimated PRs:** 5-7.
**Branch:** `sprint-auto-10-loading`.

## Sprint 11 — Empty/error states narrative refresh

**Goal:** cada empty/error state cuenta una mini historia anime, no "no data".

**Scope:**
- Revisar todos los `EmptyState` actuales.
- Mensajes con personalidad anime (no genéricos).
- Ilustraciones existentes (tanda 1 ya añadió varias).
- Actions claras (qué hacer ahora).
- Microcopy en español + inglés consistente.

**Estimated PRs:** 4-5.
**Branch:** `sprint-auto-11-empty-narrative`.

## Sprint 12 — Form UX + validation

**Goal:** validación en vivo, errores claros, sin frustración.

**Scope:**
- Formularios: login, register, password reset, edit profile, claim, vote (si aplica).
- Validación cliente + servidor consistente.
- Mensajes de error específicos (no "campo inválido").
- Estados loading/success/error visibles.
- Autofill friendly.
- Password strength meter donde aplique.

**Estimated PRs:** 5-7.
**Branch:** `sprint-auto-12-forms`.

## Sprint 13 — Search/autocomplete refinement

**Goal:** búsqueda global rápida (< 100ms perceptible), resultados relevantes.

**Scope:**
- Search bar global (si no existe, añadirla).
- Autocomplete con keyboard navigation (↑↓ + Enter).
- Fuzzy matching tolerante a typos.
- Highlight de matches.
- Recent searches en localStorage.
- Quick actions desde resultados.

**Estimated PRs:** 4-6.
**Branch:** `sprint-auto-13-search`.

## Sprint 14 — Command palette expansion

**Goal:** Cmd/Ctrl+K abre paleta con todo: navegar, buscar, acciones rápidas.

**Scope:**
- Comandos: navegar a /personajes, /animes, /torneos, /ranking.
- Búsqueda integrada.
- Acciones: cambiar tema, idioma, logout.
- Estructura modular para añadir comandos.
- Atajo visible en footer/header (Cmd+K).

**Estimated PRs:** 3-5.
**Branch:** `sprint-auto-14-cmdpalette`.

## Sprint 15 — Toast/notification system

**Goal:** sistema unificado de feedback en pantalla.

**Scope:**
- Variants: success, error, warning, info.
- Posicionamiento responsive (top-right desktop, bottom mobile).
- Queue + dedup (no apilar 10 toasts iguales).
- aria-live para accesibilidad.
- Persistencia opcional (toast con acción "deshacer" 5s).
- Configuración por componente que la dispara.

**Estimated PRs:** 3-4.
**Branch:** `sprint-auto-15-toasts`.

## Sprint 16 — PersonajeDetailPage portrait refactor (matar galería externa)

**Goal:** eliminar la dependencia visual de la galería externa (URLs Jikan/AniList que pueden romperse y mostrar recortes irregulares) en la ficha de personaje. La carta SSR sigue siendo el asset principal; añadir un **portrait propio** (cut/portrait cerrado) como acompañamiento del hero, no como galería suelta.

**Contexto del problema (confirmado por el humano):** la opción actual de galería externa no convence. Compite visualmente con la carta SSR, muestra recortes irregulares, y se rompe si la URL externa falla. El plan original ya documentó esto (`docs/FRONTEND_VISUAL_ASSET_PLAN.md` §12) pero no estaba implementado — este sprint lo cierra.

**Scope:**
- Audit de `frontend/src/components/PersonajeGaleria.jsx` y `frontend/src/pages/PersonajeDetailPage.jsx`. Identificar dónde se monta la galería en el viewport principal.
- Refactor del layout del hero de la ficha:
  - **Desktop**: carta SSR a la izquierda (sigue siendo asset principal) + **portrait propio** del personaje a la derecha (ratio 4:5 vertical o cut transparente 3:4).
  - **Mobile**: card stacked, portrait debajo en card secundaria.
- Fuente del portrait, en orden de prioridad:
  1. `frontend/img/<Anime_Folder>/portraits/<slug>.webp` (portrait cerrado 4:5, ruta futura del plan §2). Si existe, usarlo.
  2. `frontend/img/cuts/<slug>.webp` (cut transparente 4:5 o 3:4). Ya existen ~6027 cuts; `frontend/src/data/cut-slugs.js` lista los disponibles.
  3. Fallback: ocultar la sección de portrait (la carta SSR sola es suficiente).
- Galería externa (`PersonajeGaleria`):
  - **Mover a sección secundaria** colapsable al final de la ficha ("ver más imágenes").
  - **Retirar cualquier URL que falle** (404 / timeout): no debe afectar al hero.
  - No dejar que una imagen externa rota cambie el hero principal.
- Componentes nuevos / refactor:
  - `PersonajeHeroPortrait.jsx` (componente nuevo): renderiza portrait con fallback chain.
  - Reutilizar `PersonajeImg` y `PersonajeCutImg` existentes donde aplique.
- Tests:
  - Ficha de personaje no rompe si la API externa de imágenes (Jikan/AniList) falla.
  - Si no hay cut ni portrait, la ficha sigue mostrándose con la carta SSR sola.
  - Test E2E para `/personajes/luffy`, `/personajes/gojo` (top usados): verificar que el hero es estable.
- Visual:
  - El portrait NO debe robar foco a la carta SSR. La carta sigue siendo el héroe visual.
  - Animación sutil al cargar (skeleton → fade in).

### Parte 2 del sprint — Form alts (formas finales como variante visual)

**Contexto:** tanda 3 dejó listos 17 assets de formas finales con slug `<base>_<form>.webp` (luffy_gear5, naruto_baryon, goku_ultra_instinct, etc.). El humano decidió: **mismo personaje, mismo voto, mismo ranking** — las formas finales son variantes visuales del mismo personaje, no entidades separadas. UI: botón "ver forma final" con animación de transición de carta.

**Scope adicional dentro del sprint 16:**

1. **Modelo de datos**: añadir campo opcional `formAlt` (string) al schema de personajes. NO añade entrada nueva en `personajes-seed.json`, solo extiende los existentes con el slug de la forma final si existe.
   ```json
   {
     "slug": "luffy",
     "nombre": "Monkey D. Luffy",
     "anime": "One Piece",
     "imagenUrl": "/img/One_Piece/luffy.webp",
     "formAlt": {
       "slug": "luffy_gear5",
       "nombre": "Gear 5 (Joy Boy)",
       "imagenUrl": "/img/One_Piece/luffy_gear5.webp"
     }
   }
   ```
2. **Backfill `personajes-seed.json`** para los 17 chars con forma final ya generada en tanda 3:
   `luffy`→luffy_gear5, `zoro`→zoro_king_of_hell, `sanji`→sanji_diable_jambe, `naruto`→naruto_baryon, `sasuke`→sasuke_rinnegan, `satoru_gojo`→satoru_gojo_hollow_purple, `sukuna`→sukuna_mahoraga, `itadori`→itadori_black_flash, `deku`→deku_full_cowling, `bakugo`→bakugo_ap_cluster, `shoto_todoroki`→shoto_todoroki_phosphor, `nezuko`→nezuko_awakening, `muzan`→muzan_demon_final, `goku`→goku_ultra_instinct, `levi_ackerman`→levi_ackerman_odm, `light_yagami`→light_yagami_kira, `denji`→denji_chainsaw.
3. **Componente `PersonajeCardWithFormAlt`** (o ampliar `PersonajeCard` existente):
   - Render principal: carta base.
   - Si `formAlt` existe, mostrar botón flotante esquina superior derecha "✨ Ver forma final" (texto i18n).
   - Click → animación Framer Motion (crossfade + scale + leve glow dorado, 600-800ms) intercambia las imágenes.
   - Segundo click → vuelve a base con misma animación.
   - Animación respeta `prefers-reduced-motion` (degrada a fade simple sin scale).
   - El campo del DOM mantiene el slug base como identidad SEO (no cambia URL, no cambia schema.org Person/CreativeWork).
4. **Voto, ranking, ELO**: NO se duplica. La forma final es solo capa visual. El ELO/ranking/votos siguen contabilizándose contra el slug base. **Crítico**: si alguien añade `luffy_gear5` accidentalmente como entrada separada en seed, debe ser rechazado en validación.
5. **Tests**:
   - `personajes-seed.json` con `formAlt` parsea OK.
   - Personaje sin `formAlt` renderiza igual que ahora (no rompe nada).
   - Click en "Ver forma final" cambia imagen pero NO cambia URL ni emite evento de voto.
   - prefers-reduced-motion respetado.

**Estimated PRs (total Parte 1 + Parte 2):** 7-9 (era 4-6 solo Parte 1).
**Branch:** `sprint-auto-16-portrait-refactor`.
**Qué evitar:**
- Meter URLs externas como fallback del hero.
- Romper la carta SSR como asset principal.
- Eliminar la galería completa (queda colapsada al final, no se borra todo).
- Tocar el sistema de cuts existente (`CUT_SLUGS` y rutas) más allá de consumirlo.
- Crear entradas separadas para formas finales en `personajes-seed.json` — son el MISMO personaje, mismo ranking, mismo voto.
- Cambiar URL al togglear forma final (debe ser solo cambio visual, sin nav).

**Nota a futuro (FUERA del autopilot):** las cartas SSR base de los 17 chars refresh quedaron con su placeholder antiguo (no se regeneraron con calidad superior). En una pasada manual de imágenes futura (tanda 4 humano), el humano regenera esas 17 bases en alta calidad respetando la pose canónica del personaje (no la forma final). Slug destino igual: `luffy.webp`, `zoro.webp`, etc.

---

# TIER B — Features new (sprints 17-25)

## Sprint 17 — Profile customization

**Goal:** usuario puede personalizar avatar, banner, bio, theme accent.

**Scope:**
- Avatar upload (R2 con límite tamaño + tipo).
- Banner choice de presets + upload custom.
- Bio markdown limitado (sin scripts).
- Theme accent color picker (gold default, púrpura, cian, verde).
- Preview en vivo.
- Privacy toggle (público/privado).

**Estimated PRs:** 7-9.
**Branch:** `sprint-auto-17-profile-custom`.

## Sprint 18 — Personal stats dashboard

**Goal:** página `/perfil/stats` con métricas personales del usuario.

**Scope:**
- Total votos emitidos.
- Win rate en duels personales (si aplica).
- Tier en ranking global.
- Animes/personajes favoritos.
- Achievements desbloqueados.
- Heatmap de actividad (calendar tipo GitHub).
- Charts simples (Recharts o similar OSS si no añade SaaS).

**Estimated PRs:** 6-8.
**Branch:** `sprint-auto-18-stats-dashboard`.

## Sprint 19 — Match history detailed view

**Goal:** ver historial completo de duels con filtros.

**Scope:**
- Tabla paginada con duels.
- Filtros: por anime, fecha, resultado.
- Detalle por duel (panel lateral o modal).
- Export CSV opcional.
- Sin tracking externo (mantener privacy).

**Estimated PRs:** 4-5.
**Branch:** `sprint-auto-19-match-history`.

## Sprint 20 — Achievements expansion

**Goal:** sistema de logros con badges desbloqueables.

**Scope:**
- Backend: tabla `achievements`, tabla `user_achievements`.
- Catálogo inicial: 30+ logros (first vote, 10 wins, 100 wins, voted in all genres, etc.).
- Iconografía consistente (placeholders SVG, arte real viene en futuras tandas).
- Notificación al desbloquear.
- Página `/perfil/logros` (ya existe — ampliar).

**Estimated PRs:** 6-8.
**Branch:** `sprint-auto-20-achievements`.

## Sprint 21 — Daily challenges system + redesign del calendario daily

**Goal:** desafío diario rotativo para incentivar visita, **y** redesign visual completo del calendario diario.

**Heads-up del humano (feedback directo):** el calendario daily actual en la home "se ve VACÍO y FEO". Esta sprint NO es solo backend — debe incluir un redesign visual del calendario completo. Estados llenos vs vacíos diferenciados con personalidad anime, placeholder mientras carga (skeleton), microinteracciones de hover/check, mood premium consistente con el resto del sitio (dark + gold accent).

**Scope backend:**
- Tabla `daily_challenges`, generación diaria server-side.
- Tipos: "vota X duels", "votar en anime Y", "completa Z game", "raca completa", "voto por personaje femenino" (sinergia con boost Sprint 23).
- Recompensa simbólica (badge, XP si aplica, rank boost).
- Reset 00:00 UTC con timezone del usuario opcional.
- Endpoint `/api/daily-challenges/today`, `/api/daily-challenges/claim/:id`.

**Scope frontend (redesign del calendario):**
- Card del desafío en home con preview del reto + progress bar (no card vacía).
- Calendario de racha tipo heatmap (estilo GitHub) en `/desafios` y `/perfil/stats`.
- Estados: día completado (check dorado + animación), día actual (glow rojo accent), día perdido (gris), día futuro (vacío con hint).
- Animación al completar (Framer Motion: scale up + confetti dorado discreto).
- Tooltip por día mostrando el reto que fue.
- Empty state cuando no hay challenges activos: ilustración + microcopy con personalidad anime, no "no data".
- Skeleton mientras carga (variant `card-day`).

**Estimated PRs:** 7-9 (era 5-7 antes del redesign).
**Branch:** `sprint-auto-21-daily-challenges`.
**Qué evitar:**
- Dejar el calendario con casillas vacías por default antes de tener data.
- Animaciones agresivas (respetar `prefers-reduced-motion`).
- Reto del día sin preview visible (humano debe saber qué le toca antes de hacer click).

## Sprint 21b — Games hub overhaul + AniGrid rework (research-driven)

**Goal:** revisar la sección /juegos completa y rehacer AniGrid casi desde cero. La implementación actual de AniGrid es demasiado difícil y las pistas no ayudan. **Antes de tocar código, Codex DEBE investigar online cómo funcionan los juegos de referencia para comparar**.

**Heads-up del humano (feedback directo):**
- AniGrid: "demasiado difícil, las pistas no ayudan en nada". Hay que casi rehacerlo desde cero.
- Sección /juegos en general necesita una vuelta de tuerca: revisar UX, evaluar si conviene añadir más juegos, si los actuales tienen retención, etc.

### Fase 1 — Investigación obligatoria ANTES de tocar código (1-2 PRs de docs)

Codex debe **consultar fuentes reales en internet** y documentar hallazgos en `docs/games/anigrid-research.md`. Mínimo 4 fuentes distintas. Buscar:

- **AniGrid / Anidle / AnimeWordle / AnimeGuessr / Animedle** y juegos análogos populares.
- Mecánica real:
  - ¿Cuántos intentos por defecto?
  - ¿Qué atributos compara cada intento? (típicamente: anime, género del anime, año de debut, género del personaje, edad, altura, color de pelo, color de ojos, atributo principal — ej. quirk en MHA, jutsu en Naruto, etc.)
  - ¿Cómo es el feedback visual? (verde = match exacto, amarillo = parcial/cerca, rojo = lejano, flechas ↑↓ para numéricos como año/edad)
  - ¿Hay pistas pasivas o activas? ¿Coste?
  - ¿Modo daily vs práctica?
  - ¿Compartible? (formato copiar emoji tipo Wordle)
- Capturar 4-6 screenshots de referencia y dejar enlaces al `docs/games/anigrid-research.md`.
- Comparar la implementación actual (`AnidelPage.jsx`) con el patrón canónico de Wordle-style: ¿qué falta, qué sobra, qué confunde al jugador?

**Veto:** NO empezar el rework sin tener el research doc commiteado y revisable.

### Fase 2 — AniGrid rework (3-5 PRs)

Basado en la investigación de Fase 1:

- Rediseñar el flujo de adivinanza con feedback visual claro tipo Wordle (verde/amarillo/rojo por atributo).
- Tabla de atributos comparados visible tras cada intento (no solo "frío/caliente" abstracto).
- Indicadores numéricos con flechas (↑ adivina más alto, ↓ más bajo) para año, edad, altura.
- Pistas accionables, no decorativas: "este personaje pertenece al mismo anime que tu intento N°2", etc.
- Dificultad escalada: pool de personajes top-100 inicialmente (no los 1086 random — eso es la causa de "imposible adivinar").
- Modo daily (mismo personaje del día para toda la comunidad, comparable por emoji compartible) + modo práctica (random).
- Animaciones de reveal por columna al confirmar intento (Framer Motion).
- Estado de fin: resumen con stats del intento + share button (emoji grid tipo Wordle).

### Fase 3 — Games hub overhaul (2-4 PRs)

Revisar `/juegos` completa:

- Card de cada juego (Shadow Guess, Anime Reveal, AniGrid, Impostor Trial, ELO Duel, Omikuji) con stats del usuario: best streak, win rate, último resultado. No solo el cover decorativo.
- "Otros retos de hoy" — actualmente con cards muy oscurecidas (parche aplicado en commit `2efd73e` con `GameCardBackground` opacity ajustada). Confirmar que sigue legible.
- Sección "Próximamente" con teasers de juegos que el humano valore añadir. Sugerencias para evaluar:
  - **Anime Connections** (estilo NYT Connections: 16 personajes, agruparlos en 4 categorías secretas).
  - **Anime Higher/Lower** (variante: año de debut, ratings MAL, etc., no solo ELO).
  - **Voice Match** (audio voiceline → adivina personaje, requiere assets de audio que el humano debe valorar).
  - **Opening Quiz** (audio de OP → adivina anime).
  - **Frame Match** (frame de anime borroso → adivina; reutiliza dataset Shadow Guess).
  - **Power Tier Builder** (compite con la comunidad armando tu top-10 de un universo).
- Empty state cuando el usuario completó todos los retos del día: que no se vea triste, sugerir "vuelve mañana" + link a torneos/votar.
- Estadística agregada del hub: "X jugadores activos hoy", "Y partidas completadas esta semana".

### Estimated PRs Sprint 21b: 6-11 (1-2 docs + 3-5 AniGrid + 2-4 hub).
**Branch:** `sprint-auto-21b-games-overhaul`.

**Qué evitar:**
- Empezar AniGrid sin haber commiteado el research doc primero. La implementación actual ya falla por no respetar el patrón Wordle canónico — repetir el error sería costoso.
- Inflar el pool de personajes "para variedad" — los 1086 personajes hacen el juego imposible. Empezar con top-100 y subir gradualmente si el feedback lo pide.
- Añadir Voice Match / Opening Quiz sin OK explícito del humano (assets de audio = licencias + bandwidth + nuevo coste que requiere parar y reportar per AGENTS.md §7).
- Tocar el sistema de ELO de duels (separado de los juegos del hub).

---

## Sprint 22 — Streak rewards

**Goal:** racha diaria visible con incentivo.

**Scope:**
- Backend: tracking de last_login + consecutive_days.
- UI: flame icon con número de días.
- Hitos: 7, 14, 30, 100 días con celebración visual.
- Reset claro si pierdes un día.
- No pay-to-win (solo cosmético/badge).

**Estimated PRs:** 3-5.
**Branch:** `sprint-auto-22-streaks`.

## Sprint 23 — Ranking popularity FULL REBUILD desde cero + female boost + filtros

**Goal:** reconstruir el ranking de popularidad **completamente desde cero** triangulando múltiples fuentes externas autoritativas, aplicar el **female boost +25%** al final, y añadir filtros expresivos al leaderboard. El ranking actual tiene personajes en posiciones obviamente incorrectas (humano confirma: "hay algunos mal") — esto se arregla con un rebuild basado en datos externos cross-validados.

**Contexto de producto (decisión del humano):**
1. El ranking actual no refleja la popularidad real de muchos personajes. Casos típicos: secundarios poco conocidos rankeados por encima de protagonistas icónicos, personajes con apenas votos internos en top 50.
2. **Hay que reconstruirlo desde cero** consultando múltiples sitios autoritativos antes de decidir cada posición. No aplicar boost al ranking actual y ya está — eso solo amplifica el sesgo existente.
3. Una vez reconstruido el baseline, aplicar el female boost +25% sobre ese ranking limpio.

### Scope — Fase 1: ETL de popularidad ground-truth (5-7 PRs)

**Fuentes externas a triangular** (mínimo 5 por personaje top-300):

| Fuente | Acceso | Métrica usable | Notas |
|---|---|---|---|
| MyAnimeList | API pública (Jikan v4 ya en uso) | `character.favorites` | Más completa para anime clásico/mainstream. Ya hay `buscarPersonajeJikan` en el repo, reutilizar. |
| AniList | GraphQL público gratis | `Character.favourites` | Buena para anime moderno + niche. Sin auth requerida. |
| Reddit r/anime polls | Scrape de threads anuales | Position en polls "best girl/boy" | Sesgo occidental, contrarresta sesgo MAL/AniList japonés. |
| Anime Trending awards | Scrape categories "Best Boy/Girl" anuales | Win + nomination count | Premios anuales con votación pública. |
| Goo Ranking (Japan) | Scrape de rankings JP | Position en rankings JP | Sesgo japonés, importante para representación cultural. |
| Honey's Anime polls | Scrape de top-N articles | Position en listas | Complementa fuentes occidentales. |
| Crunchyroll Anime Awards | Wikipedia/oficial scrape | Nominado/ganador en categorías de personaje | Premios industriales. |

- Configurar acceso por fuente. **NO añadir coste mensual** (todas las fuentes listadas tienen tier gratuito). Si una fuente requiere SaaS de pago, descartarla y reportar.
- Si está disponible el MCP `brightdata` o equivalente OSS para scraping, usarlo. Si no, fetch HTTP + parsing (cheerio para HTML, GraphQL para AniList).
- Rate-limit respetuoso: máximo 1 req/seg por fuente, retries con backoff exponencial.
- Caché de respuestas externas en `backend/src/main/resources/cache/popularity-sources/` (filesystem JSON, no DB) — re-ejecutar el ETL no debe golpear las APIs cada vez.

### Scope — Fase 2: Algoritmo de ranking combinado (2-3 PRs)

- Servicio nuevo `PopularityRankingRebuildService` (backend).
- Para cada personaje del catálogo (`personajes-seed.json`):
  1. Resolver identidad en cada fuente externa (búsqueda por nombre + anime + alias).
  2. Recoger métrica normalizada por fuente (percentil 0-100 dentro de esa fuente).
  3. Score combinado = media ponderada de percentiles disponibles. Pesos sugeridos: MAL 0.25, AniList 0.20, Goo 0.15, Reddit polls 0.15, Anime Trending 0.10, Honey's 0.10, Crunchyroll 0.05.
  4. Si un personaje tiene <3 fuentes con datos → posición desconocida (no incluir en top, queda en cola).
  5. **Cross-validation**: si un personaje considerado "top tier obvio" (Luffy, Gojo, Goku, Naruto, Mikasa, Levi, Tanjiro, Ichigo, Eren, Light) sale fuera del top 50 del ranking reconstruido, **parar y reportar** — indica error de matching de identidades en el ETL.
- Output: tabla nueva `ranking_popularity_v2` con columnas `(personaje_id, score_combined, sources_used, sources_disagreement)`.

### Scope — Fase 3: Replace + female boost + audit (3-4 PRs)

- Migración **V30** (V1-V29 INTOCABLES): crear `ranking_popularity_v2` + columna `personajes.gender` (`enum: female | male | nonbinary | unknown`, default `unknown`).
- **Archive del ranking actual** ANTES de reemplazar: `ranking_popularity_snapshot_2026_05_pre_rebuild` (copia exacta, retención indefinida por si hay que rollback).
- Backfill `gender`: usar las fuentes externas del ETL (MAL/AniList tienen campo gender en mucho character data). Si no hay info confiable en 2+ fuentes → `unknown`.
- Endpoint admin `/api/admin/characters/:id/gender` (PATCH) + `/api/admin/ranking-rebuild` (POST, gated por auth admin) para re-ejecutar el ETL manualmente.
- `PopularityRankingService` consume `ranking_popularity_v2` como baseline. Multiplicador `POPULARITY_FEMALE_BOOST = 1.25` aplicado a personajes con `gender = female` **solo en el ranking de popularidad mostrado**. ELO de duels (`PvpEloService`) NO tocado.
- `RankingItem` DTO: añadir `gender` (string), `boostApplied` (boolean), `sourcesUsed` (int) para transparencia.
- Audit log de cada rebuild: timestamp, número de personajes actualizados, top-10 cambios más significativos vs snapshot anterior.

### Scope frontend

- En `RankingPage` y `LeaderboardsPage`: badge sutil "⚡ boost +25%" en filas con `boostApplied: true`. Tooltip: "Ranking de popularidad con boost de visibilidad para personajes femeninos."
- Indicador discreto "✓ verificado en X fuentes" (X = `sourcesUsed`) en hover sobre la posición — ayuda a transparencia.
- Filtros nuevos del leaderboard:
  - Periodo: all-time / mensual / semanal.
  - Por anime específico.
  - Por género del personaje (`female | male | nonbinary | all`).
  - Por género del anime (shonen, seinen, isekai, etc.).
  - Por país (opcional, si user opt-in).
- Toggle "modo competitivo" (boost off, ranking raw) en la UI para opt-out.
- Performance: cachear top-100 por combo de filtro (Caffeine en backend, 5 min TTL).
- Vista destacada "Top Waifus" usa el event cover `top-waifus.webp` (slot 3.18 de tanda 3).

### Estimated PRs: 10-14 (sprint grande)
**Branch raíz:** `sprint-auto-23-ranking-rebuild`.
**Sub-ramas sugeridas:** `sprint-auto-23/etl-mal-anilist`, `sprint-auto-23/etl-reddit-goo`, `sprint-auto-23/combine-algorithm`, `sprint-auto-23/v30-migration`, `sprint-auto-23/gender-backfill`, `sprint-auto-23/boost-apply`, `sprint-auto-23/frontend-filters`, `sprint-auto-23/frontend-badge`.

### Heads-up para Codex

- Esta es **una de las áreas más sensibles del autopilot** porque toca rankings públicos. Hacer el ETL con cuidado, no precipitarse a publicar.
- Si una fuente externa cambia su HTML/API y el scraper se rompe, **degradar gracilmente** (saltar esa fuente para ese personaje, marcar `sourcesUsed - 1`) en vez de abortar todo.
- Si el rebuild detecta que un personaje obviamente top-tier cae fuera del top 50 → parar y reportar (probable bug de matching).
- Cambio de lógica de ranking → comunicar claramente al usuario (badge + tooltip + sources verified count).
- Migración V30 — Codex debe respetar AGENTS.md §2 (V1-V29 intocables).
- ETL puede tomar 2-4 horas la primera vez para todo el catálogo. Hacerlo asincrónico, no bloqueante.

### Qué evitar

- Aplicar boost antes de reconstruir el baseline — el problema actual es que el baseline está mal.
- Reemplazar el ranking actual sin haber archivado el anterior (snapshot obligatorio antes de drop).
- Aplicar boost al ELO de duels (rompería balance competitivo).
- Boost por encima de **1.50** sin OK del humano (`1.25` es el target).
- Asumir género de personajes sin 2+ sources confiables. Default `unknown` es válido.
- Añadir SaaS de pago para scraping (Bright Data si está disponible OSS, perfecto; si no, fetch HTTP directo).
- Publicar el ranking nuevo sin la cross-validation contra personajes obviamente top-tier.

## Sprint 24 — Share cards (OG image generation)

**Goal:** compartir un personaje/anime/torneo genera OG image bonita.

**Scope:**
- Endpoint `/api/og/<entity>/<slug>` con `@vercel/og` o equivalente OSS (sharp + html-to-image).
- Plantillas: card SSR + nombre + stat highlight.
- Cache 24h en CDN.
- Meta tags por página (twitter:card summary_large_image, og:image).
- Test: lighthouse SEO ≥ 95.

**Estimated PRs:** 5-7.
**Branch:** `sprint-auto-24-og-cards`.

## Sprint 25 — PWA install + offline UX

**Goal:** instalable como app, funciona básico offline.

**Scope:**
- Install prompt customizado (no el feo default).
- Offline page con cache de últimas páginas vistas.
- Background sync para envíar votos pendientes.
- App manifest review (icons, screenshots, shortcuts).
- `cacheNames v3` se mantiene (AGENTS.md §2).

**Estimated PRs:** 4-6.
**Branch:** `sprint-auto-25-pwa-offline`.

---

# TIER C — Backend depth (sprints 26-32)

## Sprint 26 — Database indexes audit + query optimization

**Goal:** queries críticas < 50ms p99. N+1 eliminadas.

**Scope:**
- EXPLAIN ANALYZE en queries top 20 por volumen.
- Añadir indexes faltantes (revisar slow query log si existe).
- `@EntityGraph` o JOIN FETCH donde haya N+1.
- Pagination consistente (cursor-based donde haga sentido).
- Migración V30+ para indexes (V1-V29 INTOCABLES).

**Estimated PRs:** 5-7.
**Branch:** `sprint-auto-26-db-indexes`.

## Sprint 27 — API DTOs consolidation

**Goal:** un solo DTO por entidad de respuesta, sin leak de campos sensibles.

**Scope:**
- Audit de `Response.java`, `Dto.java`, etc.
- Consolidar duplicados.
- Verificar que `password_hash`, `totp_secret`, etc. NUNCA viajan.
- Versioning prep (`/api/v1/` namespace).
- OpenAPI generación automática.

**Estimated PRs:** 5-7.
**Branch:** `sprint-auto-27-dtos`.

## Sprint 28 — Rate limiting refinement

**Goal:** rate limits ajustados por endpoint + tipo de usuario.

**Scope:**
- Bucket por IP + por user_id.
- Limites distintos: login (5/min), vote (60/min), search (30/min), public (1000/h).
- 429 response con Retry-After header.
- Bucket persistente (Redis si aplica, in-memory si no).
- Documentar limits en API docs.

**Estimated PRs:** 4-5.
**Branch:** `sprint-auto-28-ratelimit`.
**Heads-up:** toca security/auth en parte. Si CI tira algo crítico, pausa.

## Sprint 29 — Cache strategy review

**Goal:** caché HTTP + app correctamente capeado.

**Scope:**
- Cache-Control headers por endpoint (private vs public, max-age).
- ETag/Last-Modified donde aplique.
- App-level cache (Caffeine en backend) para reads pesadas (rankings).
- Invalidación correcta al mutar.
- CDN cache rules (Cloudflare Page Rules si aplica).

**Estimated PRs:** 4-6.
**Branch:** `sprint-auto-29-cache`.

## Sprint 30 — Health checks granular

**Goal:** `/actuator/health` reporta cada componente individualmente.

**Scope:**
- DB health.
- R2 (S3-compat) health.
- Sentry-equivalent health.
- External APIs (si las hay).
- Readiness vs Liveness probes separadas (importante para K8s/Cloudflare).
- `/health/full` con detalle.

**Estimated PRs:** 3-4.
**Branch:** `sprint-auto-30-health`.

## Sprint 31 — OpenAPI spec exhaustivo

**Goal:** spec OpenAPI 3.1 completo, navegable en `/swagger-ui`.

**Scope:**
- springdoc-openapi config.
- Annotations en controllers (@Operation, @ApiResponse, @Schema).
- Examples por endpoint.
- Auth flow documentado.
- Generación de cliente TS desde spec (opcional, sin SaaS).

**Estimated PRs:** 4-6.
**Branch:** `sprint-auto-31-openapi`.

## Sprint 32 — Audit log + idempotency keys

**Goal:** trazabilidad de acciones críticas + protección contra duplicados.

**Scope:**
- Tabla `audit_log`: user_id, action, resource, before/after JSON, timestamp.
- Idempotency-Key header en POST/PUT críticos.
- Endpoint admin para consultar audit.
- GDPR-ready (poder borrar audit por user_id).

**Estimated PRs:** 5-7.
**Branch:** `sprint-auto-32-audit`.

---

# TIER D — Code quality + docs (sprints 33-40)

## Sprint 33 — Tech debt cleanup

**Goal:** purga de inconsistencias mecánicas.

**Scope:**
- Naming inconsistencies (`personaje` vs `character`, sigue convention del repo).
- Dead code: imports sin usar, funciones sin caller (con linter).
- TODO/FIXME comments: cerrar o tracking en issue.
- Magic numbers a constantes.
- File organization (mover a carpetas lógicas).

**Estimated PRs:** 6-8.
**Branch:** `sprint-auto-33-techdebt`.

## Sprint 34 — Bundle analyzer + tree-shake

**Goal:** vite build analyzer + reducción de bundle.

**Scope:**
- `rollup-plugin-visualizer` o similar.
- Identificar deps pesadas evitables.
- Tree-shake agresivo (sideEffects false donde aplique).
- Code splitting fino.
- Compression: brotli en producción.

**Estimated PRs:** 4-5.
**Branch:** `sprint-auto-34-bundle`.

## Sprint 35 — E2E + visual regression

**Goal:** cobertura E2E robusta + visual regression snapshots.

**Scope:**
- Playwright tests para flujos principales (login → vote → ranking).
- Visual regression con Playwright screenshots por viewport.
- Tests en CI con retries: 2 (intocable AGENTS.md §2).
- Reportes en GitHub Actions.

**Estimated PRs:** 6-8.
**Branch:** `sprint-auto-35-e2e`.

## Sprint 36 — ARCHITECTURE.md + diagrams

**Goal:** doc onboarding técnico exhaustivo.

**Scope:**
- ARCHITECTURE.md en root con: stack, data flow, deployment.
- Diagramas Mermaid (sin imágenes externas).
- ADRs (Architecture Decision Records) en `docs/adr/`.
- Diagrama de carpetas/módulos.

**Estimated PRs:** 2-3.
**Branch:** `sprint-auto-36-architecture-docs`.

## Sprint 37 — CONTRIBUTING.md + onboarding

**Goal:** alguien nuevo arranca local en < 15 min.

**Scope:**
- CONTRIBUTING.md con setup paso a paso.
- `.env.example` exhaustivo.
- Pre-commit hooks documentados.
- Branch naming conventions.
- PR template review.
- Code of conduct.

**Estimated PRs:** 2-3.
**Branch:** `sprint-auto-37-contributing`.

## Sprint 38 — RUNBOOK per critical scenario

**Goal:** docs operacionales para incidentes.

**Scope:**
- `docs/runbooks/`: db-restore, auth-failure, cache-stampede, ddos, deploy-rollback.
- Cada runbook: síntomas → diagnóstico → fix → verificación → postmortem template.

**Estimated PRs:** 3-5.
**Branch:** `sprint-auto-38-runbooks`.

## Sprint 39 — i18n expansion + consistency

**Goal:** todas las strings UI están en `i18n.js` keys, sin hardcode.

**Scope:**
- Audit de strings hardcoded en JSX.
- Mover a translations.
- Verificar consistencia ES/EN (mismas keys, sin missing).
- Lazy load translations si crece mucho.
- Mantener `detection.order: ['localStorage']` (intocable).

**Estimated PRs:** 5-7.
**Branch:** `sprint-auto-39-i18n`.

## Sprint 40 — Final polish + release prep

**Goal:** v1.0 ready si aplica.

**Scope:**
- CHANGELOG.md exhaustivo de todos los sprints autopilot.
- Version bump en package.json y pom.xml.
- README polish (badges, screenshots, demo link).
- License clarity.
- Press kit en `docs/press/` (logos, screenshots, copy).
- Final smoke E2E en producción.
- Tag release `v1.0.0`.

**Estimated PRs:** 3-5.
**Branch:** `sprint-auto-40-release`.

---

# TIER E — Ideas nuevas potentes (sprints 41-47)

Source: macro informe del humano. Estas son features nuevas que amplían el producto significativamente. Codex las ataca tras cerrar Sprint 40 (release prep).

## Sprint 41 — Comparador 1v1 definitivo (`/personajes/<a>-vs-<b>`)

**Goal:** ruta dedicada para comparar 2 personajes lado a lado con datos competitivos reales + social share.

**Scope:**
- Ruta `/personajes/<slug-a>-vs-<slug-b>` (parser de URL maneja orden alfabético canónico para evitar duplicados).
- Vista split con: ELO real, votos recientes (últimos 7d), historial cara a cara (cuántas veces se enfrentaron, quién ganó), favoritos de la comunidad, porcentaje "más votado", winrate por anime, comentarios contextuales del duelo.
- Share card con OG image generada (reutilizar pipeline Sprint 24).
- CTA "Vota tú este duelo" → `/votar?personaje=<a>&rival=<b>` (sinergia con fix Sprint 3.5a #4).
- Recomendación algorítmica al final: "si te interesa este duelo, también te puede gustar X vs Y".

**Estimated PRs:** 5-7.
**Branch:** `sprint-auto-41-comparador-1v1`.
**Qué evitar:** mostrar 0/0 sin contexto si nunca se enfrentaron. Caer a "todavía no se han enfrentado, sé el primero" con CTA claro.

---

## Sprint 42 — Temporadas de ranking (`/temporadas`)

**Goal:** sistema de temporadas competitivas con reset parcial, hall of fame y badges.

**Scope:**
- Backend: tabla `temporadas` (id, nombre, inicio, fin, tema, ranking_snapshot_url). Migración V31+ (V1-V29 intocables).
- Tipos de temporada: regulares trimestrales (Primavera/Verano/Otoño/Invierno 2026) + temáticas (Villanos, Waifus, Shonen, Isekai).
- Reset parcial al cerrar temporada: ELO se mantiene, pero "ELO temporada" se reinicia. Top-50 de cada temporada queda en Hall of Fame.
- Vista `/temporadas` con: temporada actual + countdown + tablas pasadas.
- Badges de "Ganador Temporada X" en el perfil.
- Cron job server-side para abrir/cerrar temporadas automáticamente.

**Estimated PRs:** 7-9.
**Branch:** `sprint-auto-42-temporadas`.
**Heads-up:** toca lógica de ranking — coordinar con Sprint 23 (rebuild popularidad + female boost). El boost femenino aplica también en temporadas o no? Decisión: SÍ por defecto, mismo toggle "modo competitivo" para opt-out.

---

## Sprint 43 — Perfil público social (`/u/<username>`)

**Goal:** perfil compartible más rico, con identidad de "trainer" anime.

**Scope:**
- Ruta `/u/<username>` pública (sin auth requerida para leer).
- Main character pickeable (carta SSR destacada como avatar grande).
- Top 5 público (si el user lo hace público en privacy settings).
- Badges destacados (3-5 elegibles).
- Rango dan/kyu basado en activity + winrate (sistema tipo judo: 9-kyu novato → 1-dan → 8-dan maestro).
- Torneos creados / participados.
- Predicciones acertadas (sinergia Sprint 32 audit).
- Racha diaria visible (sinergia Sprint 22 streaks).
- OG image generada para el share del perfil (sinergia Sprint 24).
- Toggle privacy (público/seguidores/privado).

**Estimated PRs:** 6-8.
**Branch:** `sprint-auto-43-perfil-publico`.

---

## Sprint 44 — Asset health dashboard (admin)

**Goal:** dashboard interno para monitorear estado de assets (extensión del que se hace en Sprint 3.5c).

**Scope:**
- Ya parcialmente cubierto en Sprint 3.5c — aquí se amplía:
- Histórico de errores por asset (gráfica 30d).
- Alertas si el ratio "fallback hit / total request" supera el 5%.
- Cola de "assets sugeridos para regenerar" (los que más fallback hits acumulan).
- Acción rápida: "marcar como WIP" (lo añade al allowlist) o "promover a seed" (lo quita del allowlist y regenera personajes-seed.json).
- Reporte exportable como JSON/CSV para el humano.

**Estimated PRs:** 4-5.
**Branch:** `sprint-auto-44-asset-dashboard-v2`.
**Qué evitar:** que el dashboard mismo sea pesado (limit a 100 assets visibles + paginación).

---

## Sprint 45 — Daily streak cloud (sincronizar racha local ↔ servidor)

**Goal:** la racha diaria actualmente es 100% local. Sincronizarla al backend cuando el user esté logueado.

**Scope:**
- Backend: tabla `user_streaks` (user_id, current_streak, longest_streak, last_active_date).
- Endpoint `POST /api/streaks/touch` que se llama al hacer cualquier acción daily (votar, completar reto, jugar daily game).
- Merge inteligente al login: si racha local > racha cloud, propone "tu racha local es mayor, ¿quieres reclamarla?" (anti-cheat: validar via votos efectivos).
- Ranking de rachas en `/leaderboards/streaks` (nuevo tab).
- Badges 7/30/100 días desbloqueables (sinergia Sprint 20 achievements).
- Calendario heatmap de actividad (sinergia Sprint 21 daily calendar redesign).

**Estimated PRs:** 5-7.
**Branch:** `sprint-auto-45-streak-cloud`.

---

## Sprint 46 — Modo evento en directo (overlay streamer)

**Goal:** modo para que los torneos sean watchable en directo, con overlay para streamers.

**Scope:**
- Vista `/torneos/<slug>/live`: match actual fullscreen, votos en directo, ranking actualizándose.
- QR code grande con link directo al voto del match abierto (asistentes escanean y votan desde móvil).
- Overlay para OBS/Streamlabs: HTML page minimalista que el streamer puede capturar como browser source. Muestra match + votos + countdown.
- Modo TV ya existe — extender con esta capa "live event".
- Hotkey "L" para entrar/salir de live mode (admin only).
- Estadísticas post-evento: pico de votos por minuto, distribución geográfica si aplica, MVP del evento.

**Estimated PRs:** 5-7.
**Branch:** `sprint-auto-46-live-event-mode`.
**Heads-up:** integración OBS browser source + QR code = nuevas deps (`qrcode.react` o similar). Verificar OSS y sin coste recurrente.

---

## Sprint 47 — Sistema de colecciones SSR desbloqueables

**Goal:** turn the SSR cards into a collectibles meta-loop. Vota → desbloqueas cartas → completa colecciones por anime → reward.

**Scope:**
- Tabla `user_card_collection` (user_id, personaje_slug, unlocked_at, votes_count, rarity).
- Cada N votos por un personaje desbloquea una variante de su carta (base → holo → glow).
- Colecciones por anime: "completa los 10 personajes de One Piece" → badge "Capitán Pirata" + reward visual (theme del perfil).
- Vista `/colecciones`: álbum tipo Pokédex con progreso visual.
- Rarezas: bronze (≥10 votos), silver (≥50), gold (≥200), platinum (≥500), diamond (≥1000).
- Share de colección como OG image grid (sinergia Sprint 24).
- No es pay-to-win: solo cosmético, todo desbloqueable jugando.

**Estimated PRs:** 7-10.
**Branch:** `sprint-auto-47-colecciones-ssr`.
**Heads-up:** posible synergy con formas finales del Sprint 16. Las 17 cartas con `formAlt` (luffy_gear5, naruto_baryon, etc.) pueden ser rewards de "completaste el universo" en lugar de un toggle libre. Decisión a evaluar dentro del sprint.

---

## Resumen numérico

| Tier | Sprints | PRs estimados |
|---|---|---|
| S (Foundational) | 1-8 | 51-67 |
| 🚨 PRIORITARIO (Stability/Cleanup/Pro Pass) | 3.5a, 3.5b, 3.5c | 32-39 |
| A (UX polish) | 9-16 | 29-42 |
| B (Features) | 17-25 + 21b | 50-72 |
| C (Backend depth) | 26-32 | 30-42 |
| D (Code + docs) | 33-40 | 31-44 |
| E (Ideas nuevas potentes) | 41-47 | 39-53 |
| **TOTAL** | **51 sprints** | **~262-359 PRs** |

## Convivencia con tanda 3 de imágenes

Mientras este autopilot corre, el humano sigue subiendo PNGs de tanda 3 a `_inbox/tanda-3/` en momentos puntuales. **No frenar el autopilot por eso**. Si detectas archivos nuevos en el inbox:

1. Crea rama `visuals/tanda-3-batch-NN` desde `main` actualizado.
2. Convierte PNG → WebP q88 (sharp, effort 5).
3. Mueve a su ruta canónica:
   - Cat 3 (no-banner): `frontend/public/assets/<categoría>/<slug>.webp`. Categorías: game-covers, brand/backgrounds, tournament-banners, event-covers, empty-states, error-scenes.
   - Cat 4 (SSR personajes): `frontend/img/<Anime_Folder>/<slug>.webp`. Ejecutar `npm run build:images` para generar variantes -300/-600/-1024.
4. Commit + push + auto-merge cuando CI verde.
5. Vuelve al sprint autopilot que tuvieras en marcha.

Si llega un batch enorme (50+ imágenes), respeta AGENTS.md §7: > 75 archivos → considerar split.

## Métricas de éxito

Al cierre de las 48h:
- ≥ 30 de los 40 sprints completados (75%).
- ≥ 150 PRs mergeados a `main`.
- CI verde permanente (sin sprints rotos).
- Lighthouse global mejorado: Performance ≥ 90, Accessibility ≥ 95, SEO ≥ 95, Best Practices ≥ 95.
- Sin regresión en tests existentes.
- `PROGRESS.md` actualizado con cada PR.
