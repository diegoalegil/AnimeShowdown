---
name: Plan v2 — brief completo
description: Documento íntegro del Plan v2 de AnimeShowdown tal como lo pasó el usuario. Referencia maestra para cada sub-bloque.
type: project
originSessionId: 1c6cb038-911d-4fad-a65b-ac1b468193ba
---
# AnimeShowdown — Plan v2

## Contexto

**Estado actual:** v1 lanzada en `https://animeshowdown.dev`. Spring Boot 3.5.14 en Railway, React 19 en Cloudflare Pages, PostgreSQL 17 en Neon, email vía Resend.

**Catálogo objetivo v2:** crecimiento de 125 → ~500 personajes durante el sprint en fases controladas (175 → 250 → 325 → 500). Pipeline de ingest en el Bloque 15. Todo el resto del plan dimensionado para soportar el nuevo volumen.

**Objetivo de v2:** producto con usuarios reales. Sprint intensivo verano.

**Métrica de éxito a 30 días post-launch:** Retention D7 ≥ 15% (primaria), MAU ≥ 500 (secundaria), feedback espontáneo en Twitter/email (cualitativa), conversion signup → primer voto ≥ 50% (canary).

**Filosofía:** todo metido. Ejecución al 80% deja referencia hispana de torneos anime; al 30% supera ya la definición de "v2 lanzada" del roadmap original.

---

## Decisiones técnicas cerradas

- **OG image:** Java backend con `BufferedImage`. Control total, defendible en entrevista DAM.
- **OAuth providers:** Google + GitHub + MyAnimeList + Discord.
- **Pre-render SEO:** Vite SSG híbrido — shell estático con meta correcto + datos vivos client-side.
- **Reactions granularity:** personajes + torneos + matches concretos, 4 emojis fijos `🔥❤️😂😢`.
- **Comments:** descartados. Solo reactions. Cero moderación, dato viralizable agregado.
- **Community canal primario:** Twitter/X desde día 1. Discord en septiembre con base ya calentita.
- **Akinator-style:** descartado del scope v2.

---

## Bloque 1 — Foundation y arreglo de lo roto

**Objetivo:** cerrar los 4 pain points actuales (bracket falso, login expira, OG feo, sin razón para volver) y dejar la base técnica lista.

**Dependencias:** ninguna. Kickoff del sprint.

**Habilita:** todos los bloques siguientes.

### 1.1 Vote-driven backend wiring + fix del bracket

- Eliminar `data/torneos.js` estático.
- Migrar `TorneosPage` y `TorneoDetailPage` a fetch real contra `/api/torneos` y `/api/torneos/{id}`.
- Loading states y error boundaries por página.
- `Bracket.jsx` renderiza `enfrentamiento.ganador` desde backend, no computa por ELO local.
- **Fix bug observado en producción:** el bracket actual muestra matches hasta la final como si existieran cuando el torneo no ha empezado. El nuevo comportamiento:
  - Estado `SCHEDULED` (no empezado) → solo se muestran los slots de octavos con los 16 personajes; el resto de rondas se renderiza con placeholders difuminados (no "POR DECIDIR" solo en la final).
  - Estado `IN_PROGRESS` → se muestra hasta la ronda actual + 1 con datos reales; rondas futuras siguen difuminadas.
  - Estado `FINISHED` → bracket completo con todos los ganadores.
  - Campo `torneo.ronda_actual` añadido al DTO para que el frontend sepa qué renderizar.
- `VotarPage` llama `/api/enfrentamientos/{id}/votar` real.
- Seed inicial de torneos en `DataSeeder` o cron de auto-tournament.
- Polling cada 30s en bracket activo + endpoint preparado para WebSocket del Bloque 2.

### 1.2 OG image dinámica server-side

- Endpoints `/api/og/personaje/{slug}.png` y `/api/og/torneo/{slug}.png`.
- Spring Boot + `BufferedImage` renderizando PNG 1200×630.
- Contenido: foto del personaje + nombre + anime + ELO + reactions agregadas.
- Cache 7 días con `@Cacheable` (Caffeine).
- Estrategia de pre-cache para top 100 descrita en Bloque 15.

### 1.3 Refresh tokens + httpOnly cookies + CSRF

- Tabla `refresh_tokens (id, usuario_id, token_hash SHA-256, creado_en, expira_en, revocado_en, user_agent, ip_addr)`.
- Access token JWT 15min en memoria.
- Refresh token 30 días en httpOnly cookie `SameSite=Strict; Secure`.
- Endpoints `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/revoke-all`.
- CSRF token paralelo: cookie no-httpOnly + header `X-CSRF-Token`.
- Migración client-side: eliminar JWT de localStorage, gestionar cookies automáticamente.

### 1.4 Lanzamiento público del sprint

- Cuenta `@AnimeShowdown` abierta y bio lista.
- Post día 1 anunciando: "construyo v2 en público durante 60 días".
- Plantilla de progress thread semanal preparada.

---

## Bloque 2 — Hardening backend

**Objetivo:** dejar el backend seguro y robusto antes de meter tráfico real.

**Dependencias:** Bloque 1 (refresh tokens + auth wiring).

**Habilita:** OAuth (Bloque 7), launch (Bloque 7).

### 2.1 Rate limiting

- Bucket4j con buckets in-memory Caffeine.
- `/auth/login`, `/auth/registro`, `/auth/forgot-password`, `/auth/reset-password`, `/enfrentamientos/votar`.
- Límites: 5/min + 50/hora por IP. 429 con `Retry-After`.

### 2.2 Account lockout

- Columnas `intentos_fallidos INT DEFAULT 0` y `bloqueado_hasta TIMESTAMP` en `usuarios`.
- Tras 5 fallos: `bloqueado_hasta = NOW() + 15min`, reset contador.
- Login mientras bloqueado: 423 Locked.

### 2.3 2FA TOTP

- Lib `dev.samstevens.totp:totp:1.7.1`.
- Endpoints `POST /auth/2fa/setup` (genera secret + QR), `POST /auth/2fa/verify`.
- Flow de login con `requires_2fa: true` + token temporal 60s, segundo paso pide TOTP.

### 2.4 Email verification on signup

- Tabla `email_verifications (token UUID, usuario_id, expira_en)`.
- Usuario en estado `PENDIENTE` no puede votar.
- Email Resend con link `/verify?token=XXX`.
- Tras verify pasa a `ACTIVO`.

### 2.5 Password complexity

- Regex: `^(?=.*[A-Za-z])(?=.*\d).{8,100}$`.
- zxcvbn en frontend (~4KB gzip) con barra de fortaleza visual.

### 2.6 Audit log

- Tabla `audit_log (id, timestamp, usuario_id, evento, detalles JSONB, ip_addr, user_agent)`.
- Eventos: `LOGIN_OK`, `LOGIN_FAIL`, `REGISTRO`, `PASSWORD_RESET`, `ROL_CAMBIADO`, `2FA_HABILITADO`, etc.
- AspectJ + `@EventListener` inyectando logs en endpoints auth.

### 2.7 Migración a Flyway

- Dep `flyway-core` + `flyway-database-postgresql`.
- Baseline `V1__initial.sql` exportado de Neon.
- `spring.jpa.hibernate.ddl-auto=validate`.
- Cada cambio futuro = nueva migración `V{n}__{descripcion}.sql`.

### 2.8 Backups automatizados

- GitHub Action diario `pg_dump` → Cloudflare R2 (10GB free).
- Retención: daily 7 días + weekly 4 semanas + monthly 12 meses.
- Test de restore mensual obligatorio.

### 2.9 HikariCP tuning

- `maximum-pool-size=10`, `minimum-idle=2`, `connection-timeout=20000`, `idle-timeout=300000`, `max-lifetime=900000`.
- Monitorización via `/actuator/metrics/hikaricp.connections.active`.

### 2.10 Caching layer

- Caffeine in-memory.
- `@Cacheable` en `/personajes` y `/torneos` (TTL 5 min).
- TTL más largo para listas, lookup individual cacheado por id.

### 2.11 Compresión Brotli

- Cloudflare Pages → Compression → Brotli enabled.

### 2.12 Async email queue

- `@Async("emailExecutor")` con pool dedicado de 5 threads.
- `@Retryable(maxAttempts=3, backoff=@Backoff(delay=1000, multiplier=2))`.
- Dead letter queue: tras 3 retries → tabla `email_failed_queue` + notify admin.

### 2.13 WebSocket + SSE para votos en vivo

- Spring WebSocket STOMP en `/ws/torneo/{id}`.
- Cliente con `@stomp/stompjs` suscrito al bracket activo.
- Fallback Server-Sent Events para clientes sin WebSocket.

### 2.14 API versioning

- Routing `/api/v1/*` (legacy) y `/api/v2/*` (nuevo) durante 6 meses.
- Header `Accept: application/vnd.animeshowdown.v2+json` también soportado.

### 2.15 OpenAPI spec versionada

- springdoc auto-genera spec.
- Subir a SwaggerHub free tier con versionado público.

---

## Bloque 3 — Hardening frontend y PWA

**Objetivo:** rendimiento, accesibilidad y experiencia offline al nivel de producto serio.

**Dependencias:** Bloque 1 (OG dinámica).

**Habilita:** SEO (Bloque 5), launch (Bloque 7).

### 3.1 Vite SSG híbrido

- HTML estático generado en build para cada ruta con meta correcto y shell visual.
- Datos dinámicos (votos en vivo, ranking actual) siguen siendo fetch client-side.
- Resuelve previews en crawlers que no ejecutan JS (Reddit, Discord, WhatsApp).

### 3.2 PWA + Service Worker

- `vite-plugin-pwa` con `registerType: 'autoUpdate'`.
- Manifest con iconos 192/512, theme color `#ff2e63`.
- Runtime caching: `CacheFirst` para `/personajes/*.webp`, `NetworkFirst` con timeout 3s para `/api/personajes`.

### 3.3 Migración de imágenes a AVIF

- `<picture>` con sources avif → webp → jpg.
- Script build: `avifenc` batch sobre `frontend/public/personajes/`.

### 3.4 Responsive images con srcset

- 3 tamaños generados: 300/600/1024.
- `sizes="(max-width: 600px) 300px, (max-width: 1200px) 600px, 1024px"`.
- Modificación de `scripts/convert_imgs.sh`.

### 3.5 Critical CSS inline

- `critters` Vite plugin identificando above-the-fold.
- 10-15KB de Tailwind inline en `<head>`, resto async.

### 3.6 Lazy-load de Personaje3D

- `React.lazy(() => import('./Personaje3D'))`.
- Intersection Observer activa la carga solo cuando el user llega a la sección 3D.

### 3.7 Error Boundary + Sentry

- `<ErrorBoundary>` wrapper en `App.jsx` con UI "Ups, error" + botón recargar.
- `@sentry/react` con `tracesSampleRate: 0.1`.
- Notificación email + dashboard web por cada error capturado.

### 3.8 Web Vitals tracking

- `web-vitals` lib enviando CLS/FID/INP/LCP a Plausible custom events.
- Dashboard Real User Monitoring en Plausible.

### 3.9 Accessibility audit

- `@axe-core/playwright` en CI fallando build con violations críticas.
- Test manual: navegación 100% por teclado, VoiceOver en home/personajes/votar.
- Contraste WCAG AAA donde sea posible (gradient magenta sobre dark a veces no llega a 4.5:1).

### 3.10 Bundle size budget en CI

- GitHub Action falla si el chunk principal supera 250KB gzip.
- Verificación tras `npm run build` con `stat`.

---

## Bloque 4 — Retención y mecánicas de producto

**Objetivo:** que un usuario que llega tenga 10 razones para volver. Sin esto, el SEO trae rebotes.

**Dependencias:** Bloque 1 (vote-driven backend).

**Habilita:** launch con producto retentivo (Bloque 7), extras virales (Bloque 8).

### 4.1 Perfil de usuario completo

- Página `/perfil` con tabs:
  - **Stats:** votos totales, predicciones acertadas, % acierto.
  - **Historial:** últimos 50 votos con fecha + enfrentamiento + elección.
  - **Tu Top 5:** personajes más votados por este user.
  - **Logros:** grid de badges desbloqueadas.
  - **Avatar editor:** upload + URL (ya existente, refinar).

### 4.2 Sistema de badges

- Tablas `logros (id, nombre, descripcion, icono, raro)` y `usuario_logros (usuario_id, logro_id, desbloqueado_en)`.
- Catálogo inicial: `primer_voto`, `cien_votos`, `mil_votos`, `voto_minoritario`, `predicciones_3_seguidas`, `predicciones_10_seguidas`, `torneo_completo`, `cazador_villanos`, `fanboy_anime_X`, `profeta`, `reclutador`, `daily_streak_7`, `daily_streak_30`, `daily_streak_100`.
- Backend `@EventListener` escucha eventos de voto/predicción/streak y desbloquea badges.
- Toast Sonner + sonido `playLevelUp` al desbloquear.

### 4.3 Reactions multi-nivel

- Tabla `reacciones (id, tipo VARCHAR, usuario_id, target_type, target_id, fecha)`.
- 3 niveles de target: `personaje`, `torneo`, `match`.
- 4 emojis fijos: `🔥❤️😂😢`.
- 1 reaction por user-target.
- Datos agregados visibles públicamente (input para OG image dinámica).

### 4.4 Predicciones de bracket

- Tabla `predicciones (id, usuario_id, enfrentamiento_id, personaje_predicho_id, fecha, acertada BOOL NULL)`.
- UNIQUE `(usuario_id, enfrentamiento_id)`.
- Página `/torneos/{id}/predicciones` con form.
- Leaderboard "Mejores predictores del mes".
- Badge `profeta` tras N aciertos consecutivos.

### 4.5 Friends / follow system

- Tabla `seguidores (seguidor_id, seguido_id, fecha_inicio, PK compuesta, CHECK seguidor != seguido)`.
- Botón "Seguir" en perfiles ajenos.
- Feed `/inicio` con votos recientes de seguidos.
- Notificaciones in-app y opt-in por email.

### 4.6 Leaderboards segmentados

- Por anime, por género del personaje, por época (90s/2000s/modernos), top mensual, top all-time.
- Tabs en `/ranking`.

### 4.7 Búsqueda con Meilisearch

- Self-hosted en Railway (free, 1 instancia).
- Index 500 personajes con weight por popularidad + typo-tolerance.
- Frontend con `react-instantsearch-hooks-web` reemplazando cmdk.
- Re-index cron diario tras ingest del Bloque 15.

### 4.8 Newsletter form

- Form en footer con `react-hook-form`.
- Tabla `newsletter_subs (email, confirmado, token_confirm, fecha)`.
- Double opt-in con email Resend.

### 4.9 Torneos creados por usuarios

- Solo cuentas verificadas (Bloque 2.4).
- Form: 8 o 16 personajes seleccionables, título, descripción, visibilidad pública/privada.
- Cola admin `/admin/torneos-pending` con aprobación <24h.
- Publica como torneo normal con flag `creado_por_usuario`.

### 4.10 Collaborative filtering

- Pipeline Python offline ejecutado 1x/día.
- Matriz user × personaje (1 si votó, 0 si no), cosine similarity.
- Top 5 recomendaciones por user cacheadas en tabla `recomendaciones`.
- Sección "Podría gustarte" en `/perfil`.

### 4.11 i18n ES/EN/JP

- `react-i18next` + `i18next-browser-languagedetector`.
- Archivos `locales/es.json`, `en.json`, `ja.json`.
- Tabla `personaje_descripciones (personaje_id, idioma, descripcion)` con descripciones traducidas.
- Toggle de idioma en header.
- `<link rel="alternate" hreflang>` automático.

### 4.12 Hero card 3D por personaje

Cada carta y cada vista de detalle de personaje renderiza el modelo en 3D con efecto parallax y holographic shader, transformando la experiencia visual de "imagen plana" a "carta coleccionable con volumen".

**Tres niveles según contexto y rareza:**

- **Nivel 1 — Default (todas las cards en grid `/personajes`):**
  - Imagen 2D estática + hover con CSS transform 3D sutil (rotateX/Y + perspective).
  - Coste: cero compute, solo CSS.
  - Activado siempre, también en móvil.

- **Nivel 2 — Expanded view (`/personajes/{slug}` y modales):**
  - Imagen 2D + depth map cargados en three.js + react-three-fiber.
  - Shader custom aplica desplazamiento por profundidad según la posición del ratón (o gyroscope en móvil).
  - **Holographic shader** estilo Pokemon TCG holo cards: reflejo iridiscente cromático que se mueve al inclinar.
  - Lazy-loaded vía Intersection Observer (refactor del chunk `Personaje3D` existente de 235KB).
  - Skip silencioso en dispositivos sin WebGL.

- **Nivel 3 — Legendary TCG cards (25 personajes top ELO, Bloque 10.2):**
  - Modelo GLB real generado con Meshy o Tripo3D desde la imagen 2D.
  - Visor 3D rotatorio con `<OrbitControls>` para arrastrar.
  - Auto-spin lento al hacer hover.
  - Glow effect según rareza (Legendary = aura dorada animada).

**Pipeline de generación (referenciado en Bloque 15.1 step 9):**

- Depth map con MiDaS via Replicate o Modal: `~$0.001/imagen × 500 = $0.50` one-time.
- GLB con Meshy/Tripo3D solo para Legendary: `~$0.20 × 25 = $5` one-time.
- Total catálogo completo: `~$5.50` single payment + `~$0.001` por personaje nuevo en ingest.
- Assets guardados en Cloudflare R2: `/personajes/{slug}_depth.png` y `/personajes/{slug}.glb`.
- Cache permanente, invalidación manual solo si se actualiza foto base.

**Componente unificado:**

- `<Personaje3D imagen depthMap glb={null} nivel="auto|1|2|3">` decide qué renderizar según assets disponibles + capacidades del cliente.
- Fallback graceful: si no hay depth map → CSS parallax; si no hay GLB → 2.5D shader; si no hay WebGL → imagen estática.
- Telemetría Web Vitals para medir impacto en INP.

**Integración cross-feature:**

- **`/personajes/{slug}`:** nivel 2 por defecto.
- **TCG Legendary (Bloque 10.2):** nivel 3 con OrbitControls.
- **Detector de Impostor (Bloque 14.5):** nivel 2 con holo más intenso para dramatismo.
- **Battle Royale entrada de personaje (Bloque 9):** nivel 3 con animación de entrada cinematográfica si tiene GLB, fallback a nivel 2 con flip dramático.
- **OG image dinámica (Bloque 1.2):** screenshot del nivel 2 renderizado server-side con Puppeteer para previews compartidos con sensación 3D estática.

**Performance budgets:**

- Nivel 1: <5KB CSS added per card.
- Nivel 2: <300KB total chunk (refactor del existente).
- Nivel 3: GLB <2MB per personaje, lazy-loaded solo en detail view de Legendary.
- Skip total en `prefers-reduced-motion: reduce`.

---

## Bloque 5 — SEO técnico completo

**Objetivo:** Google indexa el sitio bien, captura long-tail anime, aparece en rich snippets.

**Dependencias:** Bloque 3 (SSG).

**Habilita:** tráfico orgánico durante launch (Bloque 7).

### 5.1 JSON-LD por ruta

- Componente `<JsonLd schema={...}>` con `react-helmet-async`.
- `Person` en `/personajes/{slug}` con `characterAttribute` (ELO, anime, popularidad).
- `SportsEvent` en `/torneos/{slug}` con `competitor[]`.
- `TVSeries` en `/animes/{slug}` con `character[]` references.
- Validar con Google Rich Results Test antes de cada deploy.

### 5.2 Hook useSeo

- `useSeo({title, description, image, canonical})` extiende `useDocumentTitle`.
- Setea `<title>`, `<meta name="description">`, OG tags, canonical, twitter card.
- Plantillas:
  - `/personajes/{slug}`: `"{nombre} de {anime} | ELO {elo} | AnimeShowdown"`.
  - `/torneos/{slug}`: `"{nombre} | Bracket de {N} personajes"`.
  - `/animes/{slug}`: `"{anime} | {N} personajes en AnimeShowdown"`.

### 5.3 Canonical URLs

- `<link rel="canonical">` en cada ruta apuntando a URL canónica.
- Evita contenido duplicado entre slug y búsqueda.

### 5.4 Sitemap segmentado

- `/sitemap.xml` índice.
- `/sitemap-static.xml` (8 rutas estáticas).
- `/sitemap-personajes-{1,2}.xml` (chunks de 250 con 500 personajes totales).
- `/sitemap-torneos.xml`.
- `/sitemap-images.xml` (image sitemap con metadata).
- Script: `scripts/generate-sitemap.mjs` actualizado.

### 5.5 Image sitemap

- `<image:image>` con `<image:loc>` y `<image:title>` por personaje.
- Captura tráfico de Google Image Search.

### 5.6 Internal linking

- "Más de {anime}" completo en `/personajes/{slug}` con 5-10 personajes del mismo anime.
- "Personajes participantes" en cada `/torneos/{slug}` linkeando a cada uno.
- `/ranking` como hub con anchor text descriptivo en top 50.
- Footer con sitemap visible (categorías top: más populares, animes con más personajes, torneos finalizados).

### 5.7 Search Console + Bing + IndexNow

- Verificar `animeshowdown.dev` en Google Search Console via DNS TXT Cloudflare.
- Setup paralelo en Bing Webmaster Tools.
- IndexNow integrado en cron de auto-tournament para notificar contenido nuevo instantáneo.

### 5.8 Core Web Vitals

- LCP < 2.5s: preload de `/logo.webp` y primera card del hero.
- INP < 200ms: revisar useEffects bloqueantes, service worker para precache.
- CLS < 0.1: verificar con Lighthouse Field Data.

### 5.9 Hreflang

- Activado tras i18n del Bloque 4.11.
- `<link rel="alternate" hreflang="es|en|ja">` en cada ruta multilingüe.

### 5.10 FAQ con schema

- Página `/faq` con preguntas frecuentes ("¿Cómo funciona el ranking ELO?", "¿Quién creó AnimeShowdown?", "¿Cómo se eligen los torneos?", etc.).
- Schema `FAQPage` → accordion en SERP Google.

### 5.11 Velocidad por país

- Tests WebPageTest desde US, JP y LATAM tras cada release mayor.
- Cloudflare Pages ya da CDN global, validar latencia real.

---

## Bloque 6 — GEO y visibilidad en LLMs


**Dependencias:** ninguna (puede ir en paralelo).

**Habilita:** tráfico orgánico desde LLMs.

### 6.1 llms.txt

- Archivo `https://animeshowdown.dev/llms.txt` en raíz.
- Descripción del sitio, datos clave (500 personajes, ELO, torneos), endpoints públicos, plantilla de citation.

### 6.2 Datos comparables

- Tablas HTML semánticas en `/ranking` con datos extraíbles:
  - Top 10 más populares.
  - Personajes por anime con counts.
  - Torneos pasados con campeón.

### 6.3 Citation-friendly markup

- `<article itemscope itemtype="https://schema.org/Article">`.
- `<meta itemprop="datePublished">` y `<author>` claros.

### 6.4 Robots.txt para crawlers de IA

- Disclaimer educativo en contenido para encajar como recurso, no como propietario.

### 6.5 API docs pública

- Página `/api-docs` con OpenAPI legible para LLMs y devs.

---

## Bloque 7 — Adquisición, OAuth y community

**Objetivo:** captar usuarios reales y dejar canal de comunicación abierto.

**Dependencias:** Bloques 1-5 funcionando.

**Habilita:** ejecución del launch coordinado.

### 7.1 OAuth login multi-provider

- `spring-security-oauth2-client`.
- Providers: Google, GitHub, MyAnimeList, Discord.
- Botones en `/login` y `/registro` con cada provider.
- MAL OAuth desbloquea sync de lista de favoritos para personalización inicial.

### 7.2 Integración Jikan profunda

- Ratings reales de animes (filtrar/ordenar por rating).
- Voice actor info en perfil de personaje.
- "Personajes similares" por tags Jikan.
- Background art de animes en hero de cada `/animes/{slug}`.

### 7.3 AniList GraphQL fallback

- Endpoint público sin API key.
- Cron mensual que valida y actualiza mapa POPULARIDAD desde AniList.

### 7.4 Crunchyroll affiliate

- Programa Impact, tracking links por anime.
- Footer en `/personajes/{slug}` y `/animes/{slug}`: "Mira {anime} en Crunchyroll".

### 7.5 Spotify embed

- Embed de 30s preview del opening en `/animes/{slug}`.
- Usable también como input del modo "Guess the Anime" del Bloque 14.

### 7.6 Share intents en todos sitios

- Botones en `/personajes/{slug}` y `/torneos/{slug}`.
- Plataformas: Twitter/X, Reddit, WhatsApp, Telegram, Bluesky.
- Cada share lleva OG image dinámica del Bloque 1.

### 7.7 Cloudflare Turnstile

- Captcha gratis sin tracking en `/registro` y `/login`.
- Capa adicional sobre rate limiting del Bloque 2.

### 7.8 Discord server (lanzamiento septiembre)

- Canales: welcome, anuncios, general, torneos-activos, predicciones, fan-art, feedback, bot-spam.
- Roles: Verificado, Top Predictor, Beta Tester, Admin.
- Bot Discord.js con comandos `/voto`, `/ranking` + auto-anuncios de torneos.

### 7.9 Twitter/X content schedule

- Buffer free tier programando:
  - **Lunes:** top semanal del ranking.
  - **Miércoles:** hot take + thread de 5 tweets.
  - **Viernes:** sneak peek del torneo del fin de semana.
  - **Domingo:** cierre + predicciones lectores.

### 7.10 Instagram / TikTok / YouTube

- Instagram: 2-3 cards visuales/semana del top.
- TikTok: 1 video 15s/semana "Top 10 most popular".
- YouTube: 1 long-form retrospective/mes ("Why Luffy is #1").

### 7.11 Reddit y outreach

- Posts en r/anime, r/animenews, r/SideProject.
- Influencer outreach: Mighty Knight, Mister Charl, Javitops con propuesta de torneos custom para sus subs.

### 7.12 Presencia IRL

- Japan Weekend Madrid/Barcelona, Salón del Manga Barcelona, Tokyo Game Show.
- Llevar QR cards y stickers branded AnimeShowdown.

### 7.13 Launch coordinado

- ProductHunt 00:01 PST con asset + GIF + descripción.
- Show HN: "AnimeShowdown — full-stack with custom domain, real popularity rankings".
- Reddit r/anime con thread "we made an ELO ranking of 500 anime characters".
- Twitter thread de 8-10 tweets con screenshots + tech stack.
- Discord cross-posting con permiso a otros servers anime.

---

## Bloque 8 — Extras virales

**Objetivo:** mecanismos compartibles que generen tráfico orgánico independiente del SEO.

**Dependencias:** Bloque 1 (OG dinámica), Bloque 4 (predicciones, badges).

**Habilita:** crecimiento viral durante y post-launch.

### 8.1 Daily Challenge

- Cron 09:00 UTC selecciona matchup de ELO similar de animes distintos.
- Página `/daily/{fecha}` con votación.
- Resolución al día siguiente.
- Streak compartible con OG image dinámica de los dos personajes + resultado.
- Anti-repetición 60 días (Bloque 15.5).


- UI: pegas dos personajes, IA escribe roast cómico de quién ganaría en 4 frases.
- Botón "Compartir roast" → OG image con roast embebido.
- Cache permanente del roast por par de personajes en BBDD para evitar coste API repetido.

### 8.3 "You vs the world"

- Mini-card tras cada voto: "Eres 23% más controvertido que la media", "Estás en el 8% que vota a este villano".
- Calculado desde stats agregados, cero coste extra.

### 8.4 Heatmap del bracket

- Capa de calor visual sobre cada matchup según % de votos en tiempo real.
- Sustituye visualización ELO fría por algo emocional.

### 8.5 Embeds para blogs y wikis

- `<script>` que cualquier blog/wiki mete y muestra ranking en vivo o bracket activo.
- Target: wikis hispanas de anime.
- CORS configurado, JSONP fallback.

### 8.6 Newsletter semanal automatizada

- Cron domingo monta email: top 5 votados + matchup destacado + Daily Challenge de la semana + nuevos personajes ingestados.
- Envío vía Resend respetando opt-out del Bloque 16.

### 8.7 Sound design + confetti pulido

- SFX retro arcade japonés (packs legales libres) en: voto, predicción correcta, badge desbloqueado, daily completado, Battle Royale ganado.
- Confetti `canvas-confetti` en hitos.

### 8.8 Personaje del día en home

- Card grande rotativa al lado del hero con un personaje + bio expandida + matchup sugerido.
- Da razón para volver a la home a diario.

---

## Bloque 9 — Big bang: AnimeShowdown Live

**Objetivo:** evento masivo mensual que genere coverage social y picos de tráfico.

**Dependencias:** Bloque 2.13 (WebSocket), Bloque 4 (predicciones).

**Habilita:** posicionamiento como producto de eventos, no solo de browsing.

### 9.1 Battle Royale mecánica

- 16 personajes en arena virtual.
- Eliminación cada 4 minutos según % de votos en tiempo real.
- 1 hora total por evento.
- Página `/live` con WebSocket connection.

### 9.2 Schema de eventos

- Tabla `eventos_live (id, fecha_inicio, estado, personajes_iniciales JSONB, eliminaciones JSONB, ganador_id)`.
- Estados: `SCHEDULED`, `IN_PROGRESS`, `FINISHED`.


- Output visible en sidebar de `/live` mientras transcurre.

### 9.4 Leaderboard predictores en vivo

- Antes del evento, users predicen el ganador.
- Durante el evento, leaderboard live con quién va acertando eliminaciones intermedias.

### 9.5 Chat efímero moderado

- Sala chat solo durante el evento.
- Filtro automático de palabras del Bloque 13.
- Mensajes no se guardan tras el evento.

### 9.6 Replays

- Tras evento, replay timelapse en `/live/replays/{id}`.
- Animación reproducible para los que se perdieron el directo.

### 9.7 Marketing del evento

- Countdown en home una semana antes.
- Post diario en Twitter desde -7 días.
- Push notifications a usuarios con permiso (Web Push API).

---

## Bloque 10 — Extras meta-ambiciosos

**Objetivo:** features grandes que diferencian el producto del resto de sites de polls.

**Dependencias:** Bloque 4 (perfil).

### 10.1 Tier List Maker integrado

- Canvas drag & drop con tiers S/A/B/C/D/F.
- Catálogo de 500 personajes precargados.
- Guardar en perfil.
- Export a OG image compartible.
- Pisa terreno de TierMaker pero nativo a tu base de datos.

### 10.2 Trading Card Game / Gacha

- Cada user consigue cartas votando y prediciendo.
- Rareza balanceada al volumen 500 (ver Bloque 15.7):
  - Legendary 5% (25 cartas, top ELO).
  - Epic 15% (75 cartas, muy populares).
  - Rare 30% (150 cartas).
  - Common 50% (250 cartas).
- Crafting: 5 comunes → 1 rara.
- Trading entre users con cooldown anti-abuso.
- Sistema gacha con banner mensual temático:
  - Banner Shounen Heroes.
  - Banner Villains.
  - Banner Mujeres Fuertes.
  - Banner 90s Classics.
  - Banner Isekai.
- Pity system: tras N pulls sin Legendary, garantía de uno.
- **Solo moneda interna ganada votando. Sin compra real. Sin RMT. Cumple legalidad UE.**

---

## Bloque 11 — Extras de polish

**Objetivo:** detalles que elevan el producto sin ser core.

### 11.1 Time machine del ELO

- Tabla `elo_history (personaje_id, fecha, elo)` con snapshots diarios.
- Slider d3 en `/personajes/{slug}` mostrando evolución temporal.

### 11.2 AI character bio extendida

- Cache permanente en BBDD.
- Admin review obligatorio antes de publicar.

### 11.3 TV mode para streamers

- `/tv` modo pantalla grande sin chrome de UI.
- Rota rankings, brackets en directo, cards de personajes con animaciones.
- Autoescala según resolución.

### 11.4 API pública versionada

- Docs en Swagger UI.
- Rate limit por API key.
- Registro de developers en `/developers`.
- Webhooks para eventos clave (torneo iniciado, ganador anunciado).

### 11.5 Mascota Showdown-kun

- Diseño Fiverr (~30€) estilo chibi auténtico.
- Animaciones lottie en home, easter eggs.

### 11.6 Light mode

- Toggle en header.
- Tokens CSS con paleta espejo del dark.
- Persistencia en localStorage.

### 11.7 Card flip 3D

- Hover en personajes hace flip mostrando stats, anime, voice actor.

### 11.8 Referral system

- Código único por user.
- Badge "Reclutador Bronce/Plata/Oro" según invitados activos.

### 11.9 Leaderboard top voters

- Semanal, mensual, all-time en `/leaderboards`.

### 11.10 Memes templates

- Generador "mi top 10 favoritos" → imagen lista para Twitter.

### 11.11 Fanart submissions

- Cola admin con moderación manual.
- Copyright disclaimer obligatorio del autor.

### 11.12 Sistema de clanes

- Users se agrupan en clanes.
- ELO colectivo.
- Torneos clan vs clan.
- Chat interno del clan.

### 11.13 OG image animada APNG

- Donde Discord lo renderiza, fallback PNG.

---

## Bloque 12 — Monetización

**Objetivo:** ingresos opcionales que mantengan el proyecto sostenible.

**Dependencias:** Bloque 4 (perfil), Bloque 7 (tráfico).

### 12.1 Donaciones

- Botón Ko-fi en footer.
- Página `/apoya` con explicación.

### 12.2 Premium tier $3/mes

- Stripe Checkout.
- Beneficios:
  - Crear torneos custom (Bloque 4.9).
  - Stats avanzadas en perfil.
  - Avatar animado lottie.
  - Sin banner CTA.
  - Insignia "Supporter" visible.
  - Acceso early a features beta.
  - Sin rate limit en reactions.

### 12.3 Affiliate links

- Crunchyroll (Bloque 7.4) ya integrado.
- Footer "Mira X en Crunchyroll" en cada anime.

### 12.4 Sponsored torneos

- Landing `/sponsor` con formulario contacto.
- ~50€/torneo cuando haya >10k uniques/mes.

### 12.5 Merchandising

- Printful print-on-demand.
- Camisetas, posters, stickers branded AnimeShowdown (NO de personajes copyright).

---

## Bloque 13 — Cultura japonesa y estética otaku

**Objetivo:** identidad visual y cultural única dentro del nicho, sin caer en weeb cringe.

**Dependencias:** Bloque 4 (badges), Bloque 8 (daily).

### 13.1 Kanjis funcionales en badges

- 初 primer voto, 百 100 votos, 千 1000 votos, 王 campeón de torneo, 預 predictor profeta, 連 streak, 戦 batallador.

### 13.2 Sistema de ranks dan/kyū

- Progresión 10º kyū → 1º kyū → shodan (1º dan) → nidan (2º dan) → … → kudan (9º dan).
- Basado en: votos emitidos + predicciones acertadas + badges desbloqueadas.
- Mismo modelo cultural que judo/kendo/go.

### 13.3 Tipografía japonesa secundaria

- Noto Sans JP o Zen Maru Gothic en: nombres de torneos, badges, etiquetas.
- Body principal sin cambios.

### 13.4 Patrones tradicionales como overlay

- SVG sutiles, baja opacidad:
  - Seigaiha (olas) en hero del Battle Royale.
  - Asanoha (hojas de cáñamo) en perfil.
  - Kikkō (tortuga) en achievements.

### 13.5 Omikuji diario

- Integrado con Daily Challenge.
- Resultados auténticos 大吉/中吉/小吉/末吉/凶.
- Animación de palo cayendo del tubo.
- Compartible con OG image.
- Reset 00:00 JST.
- Sinergia: 大吉 → pista gratis del día en juegos del Bloque 14.

### 13.6 Sello hanko al ganar

- Animación de "estampar oficial" al ganar torneo, desbloquear badge importante o subir de dan/kyū.

### 13.7 Estacionalidad

- Cherry blossom petals (sakura) cayendo en home durante hanami (marzo-abril).
- Spring banner con paleta sakura (rosa pastel + verde tierno).
- Decoración especial Tanabata (7 julio) y Año Nuevo japonés (1 enero): tanzaku colgando de bambú con deseos de comunidad, kadomatsu en esquinas.

### 13.8 Glossary otaku con SEO

- Página `/glossary` con términos: tsundere, yandere, kuudere, dandere, himedere, shounen, seinen, shoujo, josei, isekai, mecha, slice-of-life, harem, reverse harem, mahou shoujo, sports anime, sentai, ecchi tag safe.
- Cada término linkea a personajes que ejemplifican el tropo.
- Schema `DefinedTerm`.
- Captura long-tail keywords masivos.

### 13.9 Animes por estación

- Filtro Spring/Summer/Fall/Winter + año en `/animes`.
- Páginas `/animes/season/{year}/{season}`.

### 13.10 Citas icónicas (meigen)

- En perfil de cada personaje.
- Japonés original + romaji + traducción ES/EN.
- Card de cita compartible con OG image dedicada.

### 13.11 SFX y voice announcer

- SFX retro arcade japonés (packs legales libres tipo Street Fighter II / Tekken-inspired).
- Voice announcer estilo anime para Battle Royale en vivo (Bloque 9): "Round one! Fight!", "K.O.!", "Perfect!" con TTS japonés o samples libres.
- Música ambiental opcional 8-bit/chiptune durante eventos.

### 13.12 Easter eggs

- Konami code (↑↑↓↓←→←→BA) desbloquea modo retro 8-bit pixel art temporal.
- Tipear nombre de personaje en home invoca animación "summon".

### 13.13 Avatar frames japoneses

- Desbloqueables: torii, dragón oriental (ryū), katana, fénix (hou-ou), oni mask, kitsune, sakura branch.

### 13.14 Iconos de clase en kanji

- Visibles en cards de personaje:
  - 剣 espadachín, 拳 luchador, 魔 mago, 巨 gigante, 弓 arquero, 銃 tirador, 影 shinobi, 神 deity.
- Mapeo desde anime + tags Jikan, datos en tabla `personaje_atributos` (Bloque 15).

### 13.15 Kaomoji en micro-feedback

- Loading states y micro-feedback: `(◕‿◕)`, `(≧◡≦)`, `٩(◕‿◕)۶`, `(´• ω •`)`, `(｡◕‿◕｡)`.

### 13.16 Título Senpai exclusivo

- Solo para Top Predictor del mes.
- Sin Kohai ni Sensei genéricos (evita cliché).

---

## Bloque 14 — Anime Games Hub

**Objetivo:** modos de juego que multipliquen retención y viralidad.

**Dependencias:** Bloque 4 (badges, perfil), Bloque 15 (`personaje_atributos`).

### 14.1 Hub `/games`

- Central que reúne todos los modos.
- Leaderboards globales y por modo.
- Badge específico 識 (shiki, conocimiento) que se suma al sistema dan/kyū (Bloque 13.2).
- Modos Daily + Endless por cada juego:
  - **Daily:** 1 partida/día, resultado compartible vía OG image tipo Wordle.
  - **Endless:** grind ilimitado para subir leaderboard.

### 14.2 Guess the Character

Tres sub-variantes seleccionables:

- **Silueta:** imagen completamente negra sobre fondo, adivinas en 6 intentos.
- **Pixelado progresivo:** imagen pixelada que se aclara con cada intento fallido o con el tiempo.
- **Bio oculta:** descripción Jikan con nombres y anime censurados, adivinas leyendo.

Sistema de pistas progresivas: cada fallo revela un atributo del target (anime → género → color de pelo → tipo en kanji → primera aparición). Score inversamente proporcional a intentos usados.

### 14.3 Guess the Anime

Cuatro sub-variantes:

- **Opening:** embed Spotify de 5-10s preview sin metadata visible.
- **Screenshot icónico:** imagen difuminada que se aclara con cada intento.
- **Plot sin nombres:** descripción del argumento con nombres propios censurados.
- **Trío de personajes:** cards de 3 personajes principales, adivinas el anime.

### 14.4 Anidel

- Wordle de personajes anime.
- Cada día un personaje secreto del catálogo.
- Hasta 6 intentos. Cada intento muestra tabla de comparación con atributos del guess vs target:
  - ✅ Anime (verde si coincide, rojo si no).
  - ✅ Género del personaje.
  - 🔄 Año de primera aparición (↑/↓).
  - 🔄 ELO actual (↑/↓).
  - ✅ Tipo/Clase en kanji (剣/拳/魔/…).
  - ✅ Rol (protagonista/antagonista/secundario).
- Resultado compartible: `Anidel #142 — 4/6 🟩🟩🟨🟥🟥`.
- Reset 00:00 JST.
- Sinergia con omikuji (Bloque 13.5): 大吉 te regala una pista gratis del día.

### 14.5 Detector de Impostor

- 4-6 cartas de personajes aparentemente del mismo anime + 1 impostor de otro anime.
- Identifícalo antes de que termine el tiempo.
- Tres niveles:
  - **Easy:** impostor de anime visualmente muy distinto.
  - **Hard:** impostor del mismo género o estética similar.
  - **Speed:** 3 segundos por ronda, encadenas hasta fallar, combo multiplica puntos.

### 14.6 Quiz mode Sporcle-style

- "Nombra los 50 personajes con mayor ELO en 5 minutos".
- "Lista los animes con más de 10 personajes en la base".
- "Encadena personajes del mismo anime sin repetir".
- Variante openings con embeds Spotify.
- Leaderboards separados por quiz.

### 14.7 Pentathlon Otaku

- Torneo mensual cross-mode.
- Compites en los 5 modos (Guess Character + Guess Anime + Anidel + Impostor + Quiz Sporcle).
- Score total agregado normalizado por modo.
- Champion del mes recibe:
  - Badge dorado 五輪王 (gorin-ou, rey de los cinco anillos).
  - Avatar frame exclusivo.
  - Slot fijo en `/ranking` durante el mes siguiente.

### 14.8 Implementación técnica común

- Endpoints:
  - `/api/games/{mode}/daily` devuelve target del día con semilla determinista.
  - `/api/games/{mode}/start` inicia sesión Endless.
  - `/api/games/{mode}/answer` valida respuesta y actualiza score.
- Frontend: componente común `<GameContainer>` orquesta state, tiempo, pistas y share UI.
- Schema BBDD:
  - `partidas (id, modo, usuario_id, score, tiempo_total, fecha, completada)`.
  - `partidas_diarias (modo, fecha, target_id, semilla)`.
  - `intentos (partida_id, valor, correcto, ms_desde_inicio)`.
- Leaderboards con materialized views refrescadas cada 5 min.
- Reutiliza 100% catálogo de personajes, animes, popularidad e imágenes.

---

## Bloque 15 — Escalado del catálogo 125 → 500

**Objetivo:** llegar a 500 personajes en fases controladas sin romper performance ni quality.

**Dependencias:** Bloque 2.7 (Flyway), Bloque 2.10 (Caffeine).

**Habilita:** capacidad real de soportar 500 personajes en frontend, SEO, OG image, daily, búsqueda y juegos.

### 15.1 Pipeline backend de ingest con multi-API fallback

Endpoint admin `/api/admin/personajes/ingest-batch` acepta lista de búsquedas por nombre o IDs MAL/AniList. Por cada personaje, dispara worker async que:

1. **Búsqueda multi-API en cascada** (fallback automático):
   - Primero: Jikan `/characters/search?q={nombre}` o `/characters/{mal_id}/full`.
   - Si falla o devuelve datos incompletos: AniList GraphQL `Character(search: $name)`.
   - Si ambos fallan: Kitsu `/characters?filter[name]={nombre}`.
   - Resultado consolidado con merge inteligente (la primera API que responda cada campo gana).

2. **Descarga y normalización de imagen** (ver Bloque 17.3 para detalles):
   - Descarga imagen principal de la fuente elegida.
   - Pasa por subject detection (face/saliency) para identificar zona principal.
   - Recorta o rellena a aspect ratio uniforme 3:4 (estándar TCG).
   - Procesa a webp + avif + responsive 300/600/1024.
   - Sube a Cloudflare R2.

3. **Generación de depth map** (para hero card 3D del Bloque 4.12):
   - Llama MiDaS via Replicate/Modal con la imagen normalizada.
   - Guarda `/personajes/{slug}_depth.png` en R2.
   - Coste ~$0.001 por personaje.

4. **Generación de GLB** (solo si el personaje será Legendary del TCG):
   - Llama Meshy/Tripo3D con imagen normalizada.
   - Guarda `/personajes/{slug}.glb` en R2.
   - Coste ~$0.20 por modelo.

5. Genera slug único con sufijo numérico si hay colisión (`luffy`, `luffy-2`).

6. Crea fila en `personajes` con estado `BORRADOR`.



9. Calcula ELO inicial mapeando popularity Jikan/AniList al rango 1500-2500.

10. Encola para admin review en `/admin/ingest-queue`.

Tras review manual + ajustes, admin marca como `ACTIVO` y el personaje aparece público.

### 15.2 Tabla personaje_atributos

- Nueva tabla con columnas para las ~20 dimensiones + índices compuestos para queries de discriminación.
- Migración Flyway `V20__personaje_atributos.sql`.
- Usada por: Anidel (Bloque 14.4), Detector de Impostor (Bloque 14.5), filtros avanzados de búsqueda (Bloque 4.7), generador de torneos temáticos (Bloque 15.5).

### 15.3 Quality gates obligatorios

Para que un personaje pase de `BORRADOR` a `ACTIVO`:

- Imagen >300×300px sin watermark.
- Anime existente en BBDD o creado en la misma transacción.
- Popularity Jikan disponible (sin null).
- Descripción >50 chars.
- Los 20 atributos rellenos (sin `unknown`).

### 15.4 Frontend escalado

- Lista `/personajes` con virtual scrolling (`react-window` o `@tanstack/react-virtual`).
- Paginación server-side para crawlers SEO con `?page=N` devolviendo HTML con 50 personajes por página.
- Búsqueda Meilisearch indexa los 500 con weight por popularidad.
- Re-index cron diario tras ingest.
- Detalle `/personajes/{slug}` sigue rápido por lookup individual cacheado en Caffeine.

### 15.5 Auto-tournament cron escalado

- Muestrea entre 500 candidatos.
- Filtros configurables: por anime, por época, por rango ELO, por género del personaje, por arma/clase kanji.
- Permite generar torneos temáticos automáticos: "Top 8 villanos de los 90", "16 mujeres más populares del shonen", etc.

### 15.6 Daily Challenge anti-repetición

- Tabla `daily_history (fecha, personaje_a_id, personaje_b_id)` con índice por personaje.
- Cron diario selecciona pareja que no haya aparecido en últimos 60 días.

### 15.7 OG image con cache inteligente

Generar OG al vuelo para 500 personajes por request rompe latencia. Estrategia híbrida:

- Top 100 personajes más visitados (según Plausible Events) pre-generados en build, servidos como PNG estático desde Cloudflare CDN.
- 400 restantes generados al vuelo en Java con cache Caffeine 7 días + fallback a regeneración.
- Invalidación manual desde admin si cambia ELO o foto.

### 15.8 Sitemap actualizado

- `sitemap-personajes.xml` partido en chunks de 250: `sitemap-personajes-1.xml`, `sitemap-personajes-2.xml`.
- Image sitemap igual.
- Referenciados desde índice maestro `/sitemap.xml`.

### 15.9 TCG con 500 cartas — re-balance

- Distribución ajustada al volumen (descrita en Bloque 10.2).
- Banner gacha mensual temático rotativo.
- Pity system anti-frustración.

### 15.10 Quality control continuo

- Admin dashboard `/admin/quality` muestra:
  - Personajes sin atributos completos.
  - Personajes con popularity null.
  - Animes sin imagen background.
  - Descripciones AI no aprobadas todavía.
  - Alertas de duplicados detectados por similitud de nombres.
- Bloquea publicación hasta resolver issues.

### 15.11 Coste realista del growth

- Por fase de 75-100 personajes: 1-2 días de trabajo curado con pipeline funcionando.
- Sin pipeline: 4-5 días por fase.
- Inversión inicial en construir pipeline (~2-3 días) ahorra ~10 días totales a lo largo del growth completo.

---

## Bloque 16 — Operations, observabilidad y compliance

**Objetivo:** operar como producto serio, no como side project. Cumplir GDPR y estar preparado para incidencias.

**Dependencias:** todo lo demás funcionando.

### 16.1 CI/CD pipelines

- GitHub Actions:
  - `backend-tests`: `./mvnw test`.
  - `frontend-build`: `npm ci && npm run build && npm run lint`.
  - `e2e-playwright`: tests E2E.
  - `smoke-test`: tras deploy a main.

### 16.2 Dependabot

- `.github/dependabot.yml` con scan semanal.
- Auto-merge para patches minor que pasan CI.
- Major updates manual.

### 16.3 Snyk security scanning

- En cada PR.
- Falla CI con CVE crítico.

### 16.4 Logging centralizado

- Logtail (Better Stack) free tier 1GB/mes.
- Logback JSON encoder.

### 16.5 CDN extra y optimización imágenes

- Bunny CDN ($1/mes) para latencia LATAM/JP.
- ImageKit.io con transformación on-the-fly.

### 16.6 Disaster recovery plan

- Documento con runbook:
  - Railway cae → reload desde docker hub a Render free (1h downtime).
  - Neon corrompe → restore desde último S3 backup (4h downtime).
  - Cloudflare DNS cae → switch a Namecheap secondary (~30min).
- Contacto emergencia: email + teléfono.

### 16.7 Load testing

- k6 script simulando 1000 concurrentes contra `/personajes` y `/torneos`.
- Stages: 30s ramp a 100 → 2min steady 1000 → 30s ramp down.
- Identificar cuellos: BBDD, JVM heap, CPU.

### 16.8 A/B testing

- GrowthBook self-hosted.
- Tests iniciales: color CTA hero (magenta vs cyan), longitud descripción, orden default en `/personajes`.

### 16.9 Feature flags

- Unleash self-hosted.
- Deploy continuo seguro: lanzar con flag OFF, activar 5%, monitorizar, rollout 100%.

### 16.10 UptimeRobot

- Ping `/actuator/health` cada 5 min.
- Notificación email + Discord webhook si cae.

### 16.11 Plausible Analytics

- Eventos custom: `signup_completed`, `login_success`, `vote_cast`, `tournament_view`, `share_clicked`, `premium_upgrade`, `daily_completed`, `game_played`.
- Funnels:
  - Visitor → signup → first vote.
  - First vote → 10 votes → daily user.
  - Daily user → premium upgrade.

### 16.12 Cohort analysis

- Dump diario CSV de `usuarios + votos`.
- Notebook Jupyter mensual con cohort retention curves.

### 16.13 Privacy Policy + Terms

- Generador Termly (free).
- Cubre GDPR, retención de datos, derechos del user, contacto DPO.

### 16.14 Cookie consent

- CookieYes (free) activado solo si Sentry session replay habilitado.
- Con Plausible solo, no necesario banner.

### 16.15 DMCA process

- Email `dmca@animeshowdown.dev`.
- Página `/dmca` con instrucciones.
- Política de retirada en 24h tras takedown notice.

### 16.16 Email opt-in/out

- Footer Unsubscribe en cada email Resend.
- Endpoint `/api/unsubscribe?token=XXX`.
- Flag `email_opt_out` en `usuarios` respetado por todos los envíos.

### 16.17 Pen test anual

- Externo con Hacken o similar ($500-1k).
- Tras cada milestone mayor.

---

## Bloque 17 — Refactor visual y fixes observados en producción

**Objetivo:** corregir bugs visuales y UX detectados en la v1 lanzada y elevar la calidad visual a nivel de producto serio.

**Dependencias:** Bloque 1 (vote-driven backend para el bracket fix), Bloque 15 (ingest pipeline para normalización de imágenes).

**Habilita:** experiencia visual coherente independientemente de la fuente de la imagen.

### 17.1 Fix del bracket — estado de visualización progresivo

Bug observado: el bracket muestra hasta la final con datos aunque el torneo no haya empezado, y solo la final dice "POR DECIDIR". Comportamiento corregido (detallado también en 1.1):

- `SCHEDULED`: solo los slots de la primera ronda con los 16 personajes participantes; resto difuminado o vacío.
- `IN_PROGRESS`: hasta ronda actual + 1 visible con datos; rondas posteriores difuminadas.
- `FINISHED`: bracket completo con todos los ganadores.
- Campo `torneo.ronda_actual` en DTO.
- Animación suave al pasar de una ronda a la siguiente (los slots de la siguiente ronda hacen fade-in cuando se completa la ronda anterior).

### 17.2 Rediseño visual del bracket

- Líneas conectoras entre matches con grosor visible (2px mínimo) y color del theme (no transparente apenas).
- Espaciado horizontal entre rondas consistente con escala proporcional al alto del bracket.
- Header de cada ronda más jerárquico: tipografía mayor, kanji decorativo (一回戦 / 二回戦 / 準決勝 / 決勝).
- Barra de progreso superior: "8 de 15 matches completados · ronda 3 de 4".
- Móvil: scroll horizontal con snap por ronda + indicador de paginación, NO stacking vertical (rompe la lectura tipo bracket).
- Animación de "victoria" cuando un personaje avanza: la card del ganador hace zoom sutil + glow.
- Estado vacío de las rondas futuras: card placeholder con kaomoji `( ? )` o silueta del kanji 未 (mi, "no aún") en lugar de "POR DECIDIR" en cada caja.

### 17.3 Normalización de aspect ratio de cartas (bug crítico)

Bug observado: imágenes de personajes con aspect ratios distintos (algunas son rip-offs de gachas externos con frame propio integrado) se ven cortadas por el contenedor común. Solución completa en pipeline de ingest (Bloque 15.1 step 2):

- **Aspect ratio uniforme objetivo:** 3:4 (TCG estándar, ej. 900×1200px).
- **Subject detection automático antes de cropear:**
  - Lib OpenCV o servicio como Cloudinary AI / imgix detecta:
    - Cara principal (face detection).
    - Saliency map (zona de interés visual) si no hay cara.
  - El crop se centra en la zona detectada, no en el centro geométrico.
- **Si la imagen original es más ancha que 3:4:**
  - Recorte centrado en el sujeto detectado.
  - Reserva del bleed: 5% de margen a cada lado del sujeto para que no quede pegado al borde.
- **Si la imagen original es más estrecha o más alta:**
  - Letterbox con fill de blur de la propia imagen (Gaussian blur 40px) como fondo.
  - Sujeto centrado en el frame final.
- **Si la imagen tiene frame externo detectable (rip-off de otra gacha):**
  - Auto-detección de bordes con alta saturación/decoración (heurística + admin flag).
  - Recorte interior eliminando el frame.
  - Si el recorte interior es <300×400px, se rechaza en ingest (quality gate 15.3).
- Resultado: todas las cartas con mismas dimensiones, sujeto centrado, fondo coherente.

### 17.4 Validación de dimensiones mínimas en ingest

Extensión del quality gate de 15.3:

- Imagen original >600×800px obligatorio.
- Tras normalización, debe quedar imagen final ≥600×800 sin upscaling (downscale OK).
- Watermark detection: rechazo automático si se detecta texto repetitivo en esquinas (ej. logos de gachas externas).
- Cartas que fallen el gate van a cola `/admin/ingest-rejected` con motivo del rechazo y opción de upload manual de versión alternativa.

### 17.5 Frontend — contenedor de carta con safety net

- CSS `aspect-ratio: 3 / 4` fijo en `.character-card`.
- `object-fit: cover` solo como red de seguridad por si entra una imagen no normalizada.
- `object-position: center top` para priorizar la cara si por algún motivo no se procesó.
- Background: gradient sutil del color predominante de la imagen (extracción con `color-thief` o equivalente en ingest, guardado en columna `personajes.color_dominante`).

### 17.6 Quick actions en hover de carta

Sobre la carta (encima del personaje, no rompiendo el layout):

- Botón vote rápido (si hay match activo con ese personaje).
- Botón share con menú radial (Twitter, Reddit, WhatsApp, copiar link).
- Botón "Ver torneos" linkea a `/torneos?personaje={slug}`.
- Botón "Stats" abre mini-modal con sparkline ELO últimos 30 días.

### 17.7 Información complementaria en cada carta

- **Stat sparkline:** mini-gráfico de evolución de ELO últimos 30 días en la esquina inferior, generado con SVG inline (sin lib).
- **Trending badge animado:** si `delta_elo_7d > 50`, animación de flecha pulsante en la esquina superior.
- **Cita icónica audio** (sinergia con Bloque 13.10): icono pequeño 🔊 que reproduce clip TTS de 3s con la cita del personaje en japonés.
- **Indicador de torneo activo:** punto pulsante si el personaje está participando en un torneo en curso.
- **Hover quick preview:** al hacer hover prolongado (>500ms), tooltip con: anime, ELO actual, votos totales recibidos, badge de rareza TCG (Common/Rare/Epic/Legendary).

### 17.8 Multi-API fallback para búsqueda de personajes

Detallado en 15.1 step 1. Resumen de proveedores y por qué los tres:

- **Jikan** (MAL unofficial): primaria. Datos más ricos en personajes mainstream, popularity real, voice actors.
- **AniList**: fallback. Mejor estructura GraphQL, mejor para personajes de nicho que MAL tiene incompletos.
- **Kitsu**: último recurso. JSON:API simple, cubre algunos personajes que faltan en los otros dos.
- Merge inteligente: el primer proveedor que responda cada campo gana, pero todos se cachean en `personaje_fuentes (personaje_id, fuente, datos_raw JSONB)` para auditoría y posibles correcciones futuras.

### 17.9 Auditoría visual periódica

- Job semanal que toma screenshot de las primeras 50 cartas en `/personajes` y las primeras 5 cartas de cada torneo activo.
- Comparación con baseline guardado.
- Alerta admin si hay regresión visual (cartas con dimensiones distintas, cropping erróneo, etc.).
- Lib: Playwright + percy.io free tier o pixelmatch comparison local.

---

## Orden recomendado de ejecución

Aunque cada bloque tiene dependencias explícitas, el orden óptimo del sprint es:

1. **Foundation primero** (Bloques 1, 2, 3) — sin esto nada más tiene sentido. Incluye fix del bracket (1.1 + 17.1, 17.2).
2. **Fixes visuales críticos** (Bloque 17.3-17.5) — normalización de cartas antes de seguir ingiriendo personajes nuevos con el bug actual.
3. **Retención** (Bloque 4) — antes de traer tráfico, asegurar que retiene.
4. **Escalado catálogo en paralelo** (Bloque 15) — construir pipeline temprano con multi-API fallback, ingestar en fases.
5. **SEO y GEO** (Bloques 5, 6) — para que el tráfico llegue.
6. **Extras virales y games** (Bloques 8, 14) — multiplicadores de share.
7. **Cultura japonesa** (Bloque 13) — identidad diferencial.
8. **Adquisición y launch** (Bloque 7) — disparo coordinado.
9. **Big bang** (Bloque 9) — primer evento mensual tras launch.
10. **Polish, meta-features y quick actions** (Bloques 10, 11, 17.6-17.9) — tras feedback de usuarios reales.
11. **Monetización** (Bloque 12) — solo con tracción validada.
12. **Operations** (Bloque 16) — transversal, ir construyendo desde el principio en paralelo.

---

**Owner:** Diego Gil.
**Última actualización:** 2026-05-10.
