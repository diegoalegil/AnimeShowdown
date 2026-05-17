---
name: Plan v2 — estado actual
description: Estado completo de AnimeShowdown — contexto, qué está hecho, qué falta, stack/arquitectura y cómo retomar
type: project
originSessionId: 1c6cb038-911d-4fad-a65b-ac1b468193ba
lastUpdate: 2026-05-17
---

# AnimeShowdown — Brief operativo

## Qué es AnimeShowdown hoy

Plataforma full-stack de **duelos, rankings ELO y torneos visuales** de personajes anime. El usuario entra, vota en duelos 1v1, ve cómo cambia el ranking, juega 5 mini-juegos diarios estilo Wordle y puede crear sus propios torneos (sujetos a aprobación admin).

**Tagline actual de la home:** "El ranking definitivo del anime lo decides tú".

**Catálogo:** 700 personajes únicos repartidos en 67 universos anime. El catálogo vive en `frontend/img/<Anime>/<slug>.webp` como source of truth — el script `scripts/sync-personajes.mjs` lo lee y regenera `frontend/src/data/personajes.js` + `backend/src/main/resources/personajes-seed.json`. El `DataSeeder` del backend sincroniza la BBDD en cada arranque (insert/update/delete cascade).

**Producción:**
- Frontend: https://animeshowdown.dev (Cloudflare Pages, free tier)
- API: https://api.animeshowdown.dev (Railway Hobby)
- BBDD: Neon Postgres 17 (Frankfurt, free tier)
- Dominio: Cloudflare Registrar `.dev` ($10.44/año, HTTPS forzado por TLD)

**Filosofía del usuario:** "Orden, limpieza, buen código y buen funcionamiento sobre velocidad". Acepta que tarde semanas. No quiere atajos.

## Stack

### Backend (`backend/`)
- Java 21 + Spring Boot 3.5.14 (Web + Data JPA + Security + Validation + Actuator)
- PostgreSQL 17 con Flyway (V1 → V12)
- JWT (`com.auth0:java-jwt 4.4.0`) + refresh tokens en httpOnly cookies (15min/30d)
- 2FA TOTP (`dev.samstevens.totp 1.7.1`) con secret cifrado AES + backup codes one-shot
- Rate limiting Bucket4j (5/min + 50/h por IP en rutas críticas)
- Account lockout (5 intentos fallidos → 15min)
- Audit log (`audit_log` + AuditLogService @Async, 14 eventos)
- WebSocket STOMP con `JwtAuthChannelInterceptor`
- Email async vía Resend HTTP API (pool dedicado emailExecutor 2-5 hilos, @Retryable + @Recover persiste en `email_failed_queue`)
- Resilience4j sobre `JikanService` + caché Caffeine 1h
- OpenAPI/Swagger UI vía springdoc 2.8.5
- Tests JUnit 5 + MockMvc + H2 (92/92 verde)

### Frontend (`frontend/`)
- React 19 + Vite 8 (HMR + Rolldown bundler) + React Compiler
- Tailwind CSS v4 vía `@tailwindcss/vite` con tokens nativos en `@theme` (paleta `#0d0d12` bg + `#ff2e63` accent magenta)
- Framer Motion 12 (parallax 3D, AnimatePresence, springs)
- React Router 7 con 24 rutas + redirects 301 vía `_redirects` de Cloudflare
- TanStack Query (cache + invalidaciones del backend)
- react-hook-form para formularios
- i18next + react-i18next (ES + EN, JP aplazado)
- Web Audio API (7 efectos sintetizados: click/hover/vote/whoosh/magic/impact/level-up con `latencyHint:'interactive'`)
- PWA con Workbox (CacheFirst para `/img/*` y `/api/og/*`, NetworkFirst para `/api/personajes` y `/api/torneos`)
- Sentry + Web Vitals (GDPR-safe: `sendDefaultPii:false`, `maskAllText:true`)
- Critical CSS inline con `beasties`
- Bundle budget 250KB gzip en CI

### Tooling
- Git monorepo (`backend/` + `frontend/`)
- GitHub Actions: tests + deploy + cron de torneos + backups DB → Cloudflare R2 (daily/weekly/monthly)
- Dependabot scan semanal con groupings (react-vendor / i18n / tanstack / sentry / eslint)
- Build command de Cloudflare: `npm run build:no-images` (skipea la generación de variantes responsive AVIF/WebP para esquivar el timeout de 20 min de CF Pages free tier)

## ✅ Hecho (bloques cerrados)

### Bloque 1 — Foundation (3/3)
- **1.1** Vote-driven backend + bracket fix. Frontend ya consume `/api/torneos` con polling 30s + WebSocket push.
- **1.2** OG image dinámica server-side (`/api/og/personaje/{slug}.png` con BufferedImage + cache Caffeine 7d).
- **1.3** Refresh tokens en httpOnly cookies + auto-refresh on 401 + detección de reuse.

### Bloque 2 — Hardening backend (15/15)
2.1 Rate limiting · 2.2 Account lockout · 2.3 2FA TOTP · 2.4 Email verification · 2.5 Password complexity · 2.6 Audit log · 2.7 Flyway · 2.8 Backups R2 · 2.9 HikariCP tuning · 2.10 Cache Caffeine · 2.11 Brotli · 2.12 Async email queue · 2.13 WebSocket STOMP + notif · 2.15 OpenAPI/Swagger.

### Bloque 3 — Hardening frontend (9/10)
3.2 PWA · 3.3/3.4 AVIF + srcset · 3.5 Critical CSS · 3.6 Lazy load · 3.7 Sentry · 3.8 Web Vitals · 3.9 A11y audit · 3.10 Bundle budget. **3.1 SSG aplazado** (incompatibilidad Vite 8 + RR 7).

### Bloque 4 — Retención (9/12)
4.1 Perfil completo · 4.2 Badges/logros · 4.3 Reactions · 4.4 Predicciones · 4.5 Follow asimétrico + `/u/:username` · 4.6 Ranking segmentado · 4.8 Newsletter · 4.9 Torneos UGC · 4.11 i18n infra (migración de strings parcial).

### Bloque 5 — SEO técnico (11/11)
JSON-LD + useSeo + canonical + sitemap dinámico + image sitemap + internal linking + FAQ schema + IndexNow + CWV preload + hreflang.

### Bloque 6 — GEO LLMs (5/5)
`llms.txt` + datos extraíbles en ranking + Microdata schema.org + robots.txt para crawlers de IA + `/api-docs` curado.

### Bloque 12 — Monetización (1/5)
**12.1** Donaciones: `/apoya` con Ko-fi + GitHub Sponsors + sección de costes reales + "También puedes ayudar gratis". Promesa de no anuncios.

### Bloque 13 — Cultura japonesa (5/16)
13.5 Omikuji diario · 13.7 Sakura petals estacional (15 mar → 15 abr) · 13.8 Glossary otaku con 30 términos · 13.12 Easter egg Konami · Kanji decorativo en todo el sistema visual.

### Bloque 14 — Anime Daily Trials (5/7, MVP cerrado)
- **14.1 Hub `/games`** rebrandeado "Anime Daily Trials" con kanji decorativo + stats (Completados hoy / Mejor racha / Countdown reset) + Omikuji integrado.
- **14.2 Shadow Guess** (`/games/shadow-guess`, antes `/games/guess-character`) — silueta borrosa, 5 intentos, PERFECT CLEAR ✨ si aciertas al primero sin pista.
- **14.3 Anime Reveal** (`/games/anime-reveal`) — adivina el anime con pistas opcionales.
- **14.4 AniGrid** (`/games/anigrid`) — Wordle de personajes, 6 intentos con comparación letra/anime/ELO.
- **14.5 Impostor Trial** (`/games/impostor-trial`) — 4 cartas del mismo anime + 1 traidor, 3 rondas, kanji 裏 (ura).
- **ELO Duel** (`/games/elo-duel`, antes `/higher-or-lower`) — Higher or Lower endless con VS animado + glow rosa al acercarse al récord.
- Las URLs viejas redirigen vía `<Navigate>` client + 301 a nivel CDN en `public/_redirects` (preserva SEO acumulado).
- Componente compartido `PanelResultadoAnime` con kanji 結/残 + sparkles + 🌸/🍂 (en vez de 🟩🟥) + tiers contextuales ("Precisión legendaria", "Otaku certificado", "Telepatía pura"…).
- "Jugar otra ronda" en los 4 daily tras completar (extras NO se persisten para no contaminar el progreso oficial).

**Aplazado:** 14.6 Quiz Sporcle, 14.7 Pentathlon mensual, modos Hard/Speed de los daily (requieren atributos extendidos del Bloque 15).

### Bloque 16 — Operations (3/17 parcial)
16.2 Dependabot · 16.13/16.15 Privacy + Terms + DMCA con Footer extendido.

### REBRAND COMPETITIVO completo (sesiones 2026-05-17)

El usuario pidió en su propuesta detallada que toda la plataforma se sintiera "una arena de duelo viva creada por fans" en lugar de un dashboard SaaS genérico. Aplicado en todas las páginas principales:

- **Home** (`/`): "El ranking definitivo del anime lo decides tú" + CTAs Votar / Ranking · Stats sin "0 torneos" (badge ping "Ranking en vivo") · Duelo en vivo con VS pulsante glow · Top 10 ELO outline magenta · Sección Anime Daily Trials con kanji · Bento "Una competición viva creada por fans" · Footer descripción nueva.
- **Personajes** (`/personajes`): Header "Catálogo completo · 700 personajes" · 7 sorts (Popularidad, Mayor/Menor ELO, Mejor WR, Nombre A-Z/Z-A, Anime) · CTAs inferiores Votar/Ranking/Animes · Vista lista con W/D + WR + botón "Ver ficha".
- **Ficha de personaje** (`/personajes/:slug`): Badges "#N ranking ELO" yellow Trophy + "#N de Anime" accent · 3 CTAs Votar/Ver ranking/Compartir (Web Share API + clipboard fallback) · "Stats disponibles cuando participe en más enfrentamientos" si 0V/0D · Nav prev/next con "Anterior/Siguiente" bold.
- **Animes** (`/animes`): Rebrand a "Universos anime" · Buscador con aliases ("kimetsu" → Demon Slayer, "snk" → AOT, "mha" → MHA) · 5 sorts (Destacados ponderado / Más personajes / Mayor ELO máx / Mayor ELO promedio / A-Z) · Cards con collage representativo (no random, mezcla popularidad + ELO) + Top ELO visible + glow rosa hover.
- **Página individual de anime** (`/animes/:slug`, NUEVA): Hero con collage clickeable de los 4 representativos · 4 stats agregados (Personajes / Top ELO / ELO promedio / Combates totales) · CTAs "Votar personajes de X" + "Ranking global" · Roster principal 6 destacados por popularidad · Ranking interno top 10 por ELO con podio (yellow #1, amber #2-3) · Grid completo de los N personajes · Outro "Tu personaje favorito no sube solo".
- **Ranking** (`/ranking`): "¿Quién domina AnimeShowdown?" + CTAs Votar/FAQ · Tabs renombradas (ELO actual / Histórico / Este mes / Por anime) · Búsqueda + filtro por anime · **Podio Top 3** (Crown + glow yellow campeón centro, plata zinc izquierda, bronce orange derecha) · Filas Top 10 con border yellow + badge "Top 10" + W/D coloreado · Hub "Sigue moviendo el ranking" con 3 CTAs · Tabla extraíble plegable `<details>`.
- **Votar** (`/votar`): Layout compacto sin scroll · Skip arriba derecha + toggle "Modo rápido" persistido en localStorage (auto-next 1.2s tras voto) · VS central glow magenta pulsante · Nombre + anime DEBAJO de cada card (no overlay) · Atajos teclado `←` `→` `S` `Espacio` con `<kbd>` styled · Ganador glow + ring · Perdedora opacity-40 grayscale · "Ver ficha →" tras votar.
- **Apoya** (`/apoya`): Header cercano · Cards Ko-fi (gradient amber) + GitHub Sponsors (gradient fuchsia) con CTA visible · Sección "¿En qué ayuda tu apoyo?" con tiles transparentes (hosting backend, BBDD, dominio + CDN, nuevos modos, más personajes, mejoras visuales) · Sección "También puedes ayudar gratis" con mismo peso visual (Compartir / Star GitHub / Sugerir / Invitar) · Promesa pulida.
- **Perfil** (`/perfil`): Separado en tabs (Resumen / Logros / Mis torneos / Ajustes) · Header "Mi cuenta · Tu espacio personal" · Card usuario con nota de privacidad + CTAs Perfil público + Votar ahora · Card cerrar sesión compactada horizontal · Microcopy más cercano.
- **Footer**: NewsletterForm con `w-full + min-w-0` (deja de desbordar a Navegación) · Descripción "plataforma de duelos, rankings ELO y torneos visuales" · Newsletter intro "Recibe nuevos torneos, rankings destacados y retos diarios" · Top animes ahora linkean a `/animes/:slug` (no filtros de personajes).

### Componente clave: PersonajePlaceholder anti-roto
`frontend/src/components/PersonajePlaceholder.jsx` sustituye el icono de imagen rota del navegador por una carta con identidad: gradient diagonal con tono determinístico por nombre, kanji 戦 decorativo de fondo, iniciales grandes ("Monkey D. Luffy" → "ML"), nombre + anime + "Imagen pendiente". `PersonajeImg` lo monta via `onError`. **Nunca se muestra el icono `?` roto en producción**.

### Bug fix crítico de imágenes en producción (resuelto)

Tres causas combinadas se arreglaron en cascada en sesiones recientes:

1. **`slugToImagen` Map borrado**: la regeneración del catálogo 125→642 borró el Map sin querer, así que `imagenPersonaje()` lanzaba `ReferenceError` y el frontend pintaba `<img src=undefined>` (icono roto en TODA la web). Restaurado en `personajes.js`.
2. **40 paths con espacios literales** (`/img/Code Geass/cc.webp`): los espacios sin URL-encoding daban 404 en CF. Renombradas 8 carpetas (`Code Geass` → `Code_Geass`, `Date A Live` → `Date_a_Live`, etc.) + actualizados los 40 paths con Python sed.
3. **Variantes responsive (-300/-600/-1024 .webp + .avif) contaminando el catálogo**: el script `generate-image-variants.mjs` escribía en `frontend/img/` (no en `dist/`). Cuando se regeneró el catálogo, esas variantes se trataron como personajes nuevos → 2815 entries en `personajes.js` cuando solo hay 700 personajes únicos. Resultado en /personajes y /votar: cards con nombres tipo "Aoi Todo-1024", "Wave-300", "Pandora-300", todas con imagen rota porque las variantes responsive NO llegan a producción (CF usa `build:no-images`).
   - Borradas 4218 variantes de `frontend/img/`.
   - Filtrado `personajes.js`: 2815 → 700 entries.
   - `PersonajeImg` simplificado de `<picture>` con srcset a `<img>` simple (las variantes responsive no llegan al CF, así que el `<source>` daba 404 → icono roto; el `<img>` dentro de `<picture>` NO es fallback para 404, solo para media queries no soportadas).

**Lección operacional**: si en algún momento se quiere reactivar el `<picture>` responsive en producción, hay que cambiar el build command de CF a `npm run build` (no `:no-images`) y soportar el timeout de 20 min, o bien commitear las variantes generadas al repo.

## 🟡 Pendiente — orden recomendado

### Inmediato (próxima sesión)
1. **Verificar deploy del rebrand competitivo en producción** — el usuario debe hacer hard refresh (Cmd+Shift+R) tras cada batch para invalidar SW cache. Posibles regresiones a comprobar:
   - Footer overlap de NewsletterForm (fix aplicado con `w-full + min-w-0`).
   - Cards de animes con collage representativo (esperar que ya no salgan personajes random).
   - Imágenes en /personajes y /votar (debería estar resuelto tras los 3 fixes en cascada).
2. **Bloque 4.7** Búsqueda Meilisearch (pendiente).
3. **Bloque 4.10** Achievements page pública (pendiente).
4. **Bloque 4.12** Personajes por similitud (recomendaciones).

### Mejoras pendientes de las propuestas del usuario que NO se han implementado
1. **Perfil — stats rápidas en card principal** (votos, logros, torneos, rango). Requiere queries al backend o endpoint nuevo agregado.
2. **Perfil — nuevo logro "Primer apoyo"** (desbloquear compartiendo o dando star en GitHub). Requiere lógica de tracking en backend.
3. **Perfil — sección "Actividad reciente"** (últimos votos, logros, torneos). Requiere endpoint nuevo.
4. **Perfil — "Eliminar cuenta"** con confirmación doble. Requiere flujo de seguridad.
5. **Votar — feedback con +ELO/-ELO** tras votar (mostrar cambio numérico). Requiere que el backend devuelva el delta en la respuesta de votar.
6. **Votar — emparejamientos balanceados** (evitar diferencias enormes de ELO, priorizar personajes con pocos votos).
7. **Ranking — indicadores de subida/bajada** (↑2, ↓1, "Nuevo"). Requiere histórico de posiciones.
8. **Animes — géneros/clasificación** (Shonen, Romance, Isekai…). Requiere atributos extendidos (Bloque 15).
9. **Impostor — timer real 15s por ronda + barra visual + glitch hover** en cartas sospechosas.
10. **Apoya — meta mensual transparente** ("12€ / 25€").

### Bloques grandes pendientes
- **Bloque 7** Datos sociales/comparte (algunos sub-puntos ya cubiertos por reactions + follow).
- **Bloque 8** Discovery (recomendaciones, "similar a").
- **Bloque 9** Mod tools (admin panel ampliado).
- **Bloque 10** Analytics + dashboards internos.
- **Bloque 11** TV mode + Mi Top 5 + Top voters (5/13 entregados).
- **Bloque 12** Pricing (12.2 Premium $3/mes aplazado hasta volumen real).
- **Bloque 15** Escalado del catálogo a 1000+ personajes con atributos extendidos (género/género personaje/era/popularidad MAL/AniList/Reddit, etc.) — **bloqueado por usuario añadiendo imágenes nuevas**.
- **Bloque 16** Operations completo (CI matriz, alertas, runbooks, on-call).
- **Bloque 17** Variantes de bracket (single/double elim, swiss, round-robin) — 1.1 cubrió el bracket progresivo, el resto pendiente.

### Aplazados sin fecha
- **2.14** API versioning `/api/v1/*` — prematuro hasta breaking changes reales.
- **3.1** SSG — incompatible con Vite 8 + RR 7, requiere migrar a vike o esperar adapter.
- **i18n** completar migración de strings al `t()`. Hoy traducidas: Header / Footer / Hero / NewsletterForm / TorneosPage. Pendientes: Home (secciones grandes), Perfil, Votar, Ranking, Personajes, Animes, Crear torneo, Admin, Auth (Login/Register/Forgot/Reset/Verify), HigherOrLower, Newsletter, 404.

### Tareas operativas pendientes del USUARIO
- Añadir imágenes de animes nuevos que tiene en cola (Code Geass está, falta ampliar; Toradora, Solo Leveling, Hyouka más, Date A Live ampliado…).
- Cuando termine, correr `node scripts/sync-personajes.mjs` para regenerar `personajes.js` + `personajes-seed.json`.
- Decidir si reactivar el build completo en Cloudflare (con variantes AVIF) o mantener `build:no-images` (más rápido pero sin srcset responsive).

## Decisiones técnicas clave para retomar

- **Estados torneo**: `SCHEDULED / IN_PROGRESS / FINISHED` (renombrados desde BORRADOR/ACTIVO/FINALIZADO en V2).
- **Catálogo personajes**: vive en `frontend/src/data/personajes.js` (700 entries actualmente). Helper `imagenPersonaje(slug)` lee de un `Map slug→path` construido al cargar el módulo. **NO regenerar el catálogo desde imágenes con variantes presentes** — si están las `-300.webp`/`-600.webp`/`-1024.webp`/`.avif` en `frontend/img/`, el script las trata como personajes nuevos. Hay que borrarlas primero (`find img -type f \( -name "*-300.webp" -o -name "*-600.webp" -o -name "*-1024.webp" -o -name "*.avif" \) -delete`) y luego correr el sync.
- **VotarPage**: modo híbrido (match real del backend si hay torneo IN_PROGRESS; casual con pares random local si no).
- **Build CF**: `npm run build:no-images` (esquiva el timeout de 20min). Variantes responsive AVIF/WebP NO llegan a producción → `PersonajeImg` usa `<img>` simple con onError fallback a `PersonajePlaceholder`.
- **Rutas con redirects 301**: el rebrand de juegos cambió URLs pero las viejas siguen funcionando vía `<Navigate replace>` client-side + `_redirects` de CF para CDN-level. Mapeo:
  - `/games/guess-character` → `/games/shadow-guess`
  - `/games/guess-anime` → `/games/anime-reveal`
  - `/games/anidel` → `/games/anigrid`
  - `/games/impostor` → `/games/impostor-trial`
  - `/higher-or-lower` → `/games/elo-duel`
- **Estilos visuales**: el usuario pidió "preguntar antes de tocar JSX/CSS" en sesiones anteriores, pero las propuestas detalladas que mandó ÚLTIMAMENTE le dan carta blanca para aplicar — preguntar solo en cambios fuera del alcance de la propuesta.
- **Tests**: 92/92 verde tras todo el trabajo backend reciente. `TestAsyncConfig` con `SyncTaskExecutor` para tests que dependen de @Async.
- **React Compiler**: estricto con refs en render (`votedRef.current = X` durante render → error). Solución: añadir el valor a deps del `useCallback`. Tampoco permite `Math.random` en hooks puros (usar `useState` lazy init).
- **CI lint**: `eslint.config` baja `react-hooks/incompatible-library` a warn por orden de aplicación de flat config; warnings residuales en `useLogros.js` por `queryKey` dep.
- **Secrets que el usuario tiene que configurar en producción**: `TOTP_ENCRYPTION_KEY` (openssl rand -base64 32), `APP_INDEXNOW_KEY` + `_HOST` + `_BASE_URL`, `NEON_DATABASE_URL` (sin -pooler para backups), `R2_ENDPOINT/ACCESS_KEY_ID/SECRET_ACCESS_KEY`, `ADMIN_EMAILS` para auto-promote, `RESEND_API_KEY`, `JWT_SECRET`, `VITE_SENTRY_DSN`.

## Cómo retomar en la próxima sesión

1. **Leer `MEMORY.md`** primero (índice de memorias). Este archivo se referencia desde ahí.
2. **Si el usuario dice "sigue con bloque X"**: ir a la sección hecho/pendiente correspondiente y arrancar.
3. **Si pide cambios de páginas existentes**: hay propuestas detalladas pendientes en la sección "Mejoras pendientes de las propuestas". Reaplica el patrón ya usado (badges + CTAs + glow rosa + microcopy cercano).
4. **Antes de tocar imágenes del catálogo**: revisar que no haya variantes contaminando `frontend/img/`. Verificar con `find frontend/img -type f -name "*-300.webp" | wc -l` → debe ser 0.
5. **Antes de tocar `personajes.js`**: count actual de entries debe ser 700 (`grep -c "slug:" frontend/src/data/personajes.js`). Si es 2815+ es que hay contaminación de variantes — re-aplicar el cleanup.
6. **Tests backend** deben estar 92/92 verde antes de tocar nada del backend.
7. **Cada cambio de schema** = nuevo `V{n}__{descripcion}.sql` en `backend/src/main/resources/db/migration/`.
8. **Push automático** tras cada commit (regla del usuario en feedback memory).
9. **CI lint** corre `npm run lint` — falla con errores reales (ej. unused imports tras refactors). Mantenerlo verde.

## Sub-bloques importantes con detalles operativos

### Generación de variantes de imagen (`scripts/generate-image-variants.mjs`)
Procesa `frontend/img/<Anime>/<slug>.webp` con sharp → genera `slug-300/600/1024.webp` + `.avif`. **CRÍTICO**: escribe en `frontend/img/` (no `dist/`), así que contamina las fuentes. El `.gitignore` ignora las variantes, pero el script de sync del catálogo las ve y las registra como personajes nuevos. **Recomendación**: ejecutar este script SOLO desde el build pipeline (no a mano), o cambiarlo para escribir en `dist/img/` directamente.

### Sync del catálogo (`scripts/sync-personajes.mjs`)
Lee `frontend/img/` y regenera `frontend/src/data/personajes.js` + `backend/src/main/resources/personajes-seed.json`. Soporta `--dry-run`. Si un slug colisiona entre animes (ej. `lucy` en Pokemon y Elfen Lied), prefija con el folder.

### DataSeeder (`backend/src/main/java/.../DataSeeder.java`)
En cada arranque de Spring Boot lee `personajes-seed.json` y sincroniza la BBDD: inserta nuevos, actualiza cambios (imagenUrl, descripción, nombre, anime), borra retirados con cascada de votos+enfrentamientos. Todo en `@Transactional`. Idempotente — seguro re-ejecutar.

### Cron de torneos automáticos
GitHub Actions cada 3 días → `POST /api/admin/torneos/generar-random` con login OAuth + secret. Crea un torneo de 8 personajes random del catálogo. Si el secret no está configurado en GH secrets, falla y notifica al usuario. Configurado por el usuario el 2026-05-16.

### Backups Neon → R2
`.github/workflows/db-backup.yml` cron diario 04:00 UTC + `workflow_dispatch`. `scripts/backup-and-rotate.sh` con `pg_dump --format=custom`, sube a `daily/` del bucket, copia a `weekly/` los lunes y `monthly/` el día 1, rota daily>7d / weekly>28d / monthly>365d. Bucket `animeshowdown-backups` (R2 free tier 10GB). Instala `postgresql-client-17` desde repo oficial PG porque ubuntu-latest trae 16 y Neon corre 17.

### WebSocket STOMP
Backend: `WebSocketConfig` con SimpleBroker `/topic` + `/queue` y `JwtAuthChannelInterceptor` que valida Bearer en CONNECT. `NotificacionService` con doble canal (persistencia en `notificaciones` + push `convertAndSendToUser`). Broadcast `BracketUpdateEvent` a `/topic/torneo.{id}.bracket` tras cada voto. Frontend: `lib/stomp.js` Client singleton con `beforeConnect` que refresca el JWT en cada reconexión. `useStompSubscription` + `useNotificaciones` + `useUnreadCount`. `useTorneoBySlug` invalida la query al recibir push del bracket (polling 30s queda como fallback).

### Tabla de logros (14 badges seed)
`primer_voto` · `cien_votos` · `mil_votos` · `primer_torneo_creado` · `predicciones_3_seguidas` · `predicciones_10_seguidas` · `profeta` · `seguidor_primero` · `seguido_por_5` · `legendario_top10_elo` · `racha_diaria_7` · `racha_diaria_30` · `embajador` · `early_bird`. Eventos `@TransactionalEventListener(AFTER_COMMIT) + @Async` desbloquean. Frontend `BadgeUnlockListener` global con toast Sonner + playLevelUp + canvas-confetti escalado por rareza (skip en prefers-reduced-motion).

## Glosario rápido

- **PERSONAJE**: entidad del catálogo. Slug único, anime, descripción, imagen.
- **VOTO**: 1 usuario por personaje y por enfrentamiento (UNIQUE constraints).
- **ENFRENTAMIENTO**: 1v1 dentro de un torneo o casual.
- **TORNEO**: bracket de 8 o 16 personajes. Estados SCHEDULED/IN_PROGRESS/FINISHED.
- **ELO local**: calculado en frontend desde `popularidad` del catálogo (`getStatsPersonaje`). Se usa cuando no hay datos del backend (fallback).
- **ELO real**: derivado del histórico de votos del backend.
- **Daily**: 1 partida al día con personaje determinístico por fecha local (no UTC).
- **Extra**: en los daily games, partida random después del daily, no persiste en localStorage.
