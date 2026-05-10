# V2_ROADMAP.md — AnimeShowdown

**Documento vivo del plan de evolución de AnimeShowdown.**
Estado actual del proyecto: **v1 lanzado en producción** en `https://animeshowdown.dev`. Backend Spring Boot 3.5.14 en Railway, frontend React 19 en Cloudflare Pages, BBDD PostgreSQL 17 en Neon, email vía Resend, dominio `.dev` premium, 23 tests verde, smoke 8/8 verde.

Este doc cubre **TODO** lo que haría falta para llevar el proyecto de portfolio DAM a un producto vivo, mantenido, posicionado y monetizable. Léelo de arriba a abajo en orden — la priorización está implícita en la estructura.

---

## 0. Filosofía y criterios de decisión

Antes de añadir cualquier cosa de las que vienen abajo, preguntar:

1. **¿Lo justifica la métrica de negocio?** Si no hay usuarios suficientes para que la feature mueva la aguja, esperar. No optimizar prematuro.
2. **¿Cabe en el presupuesto cero?** v1 cuesta 12$/año (dominio) + 5$/mes Railway. Cada feature debe respetar esto o tener ROI claro.
3. **¿Aumenta el tiempo de mantenimiento?** Cada lib nueva = 1h/mes en updates de seguridad y compatibilidad.
4. **¿Se puede defender en una entrevista?** Si la respuesta a "por qué hiciste esto" es "porque sí", no se hace.

**Definición de "v2 lanzada":** capacidad técnica de soportar 10.000 usuarios mensuales activos sin refactor de emergencia, con SEO posicionado en top 5 para "torneos de anime", y un funnel de captación funcionando.

---

## 1. SEO y posicionamiento en Google

El sitio actual tiene `sitemap.xml` con 141 URLs y `robots.txt`, pero falta el resto del paquete SEO.

### 1.1 Schema.org JSON-LD por ruta

Añadir bloques `<script type="application/ld+json">` específicos para cada tipo de página. Spring Boot puede generarlos server-side, o React Helmet client-side en SPA.

**`/personajes/{slug}` — Schema `Person`:**

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Monkey D. Luffy",
  "alternateName": "Luffy, Mugiwara",
  "description": "Capitán pirata de los Sombrero de Paja...",
  "image": "https://animeshowdown.dev/personajes/luffy.webp",
  "url": "https://animeshowdown.dev/personajes/luffy",
  "characterAttribute": [
    {"@type": "PropertyValue", "name": "ELO", "value": 2192},
    {"@type": "PropertyValue", "name": "Anime", "value": "One Piece"},
    {"@type": "PropertyValue", "name": "Popularidad", "value": 100}
  ]
}
```

**`/torneos/{slug}` — Schema `SportsEvent`:**

```json
{
  "@context": "https://schema.org",
  "@type": "SportsEvent",
  "name": "Shōnen Showdown",
  "startDate": "2026-05-07",
  "endDate": "2026-05-09",
  "eventStatus": "EventScheduled",
  "competitor": [
    {"@type": "Person", "name": "Monkey D. Luffy"},
    ...
  ]
}
```

**`/animes/{slug}` (cuando exista) — Schema `TVSeries` con personajes como `character` references.**

**Implementación:**
- Crear componente `<JsonLd schema={...} />` que pinta el `<script>` en `<head>` (vía `react-helmet-async`)
- Test: validar con [Google Rich Results Test](https://search.google.com/test/rich-results)
- Esperado: aparecer en knowledge panel de búsqueda en 2-4 semanas tras indexación

### 1.2 Open Graph y Twitter Card dinámicos

Hoy `index.html` tiene OG estático ("125 personajes, brackets..."). Para que cada URL compartida en WhatsApp/Twitter/Discord muestre un preview específico, hay que setearlo por ruta.

**Opciones (por complejidad ascendente):**

1. **react-helmet-async** (10 min): cliente setea `<meta>` dinámico, pero los crawlers que no ejecutan JS no lo ven. Twitter lo ejecuta a veces, Discord no.
2. **Pre-render con Vite SSG** (3-4h): genera HTML estático para cada ruta `/personajes/luffy`, etc. con OG correcto. Mejor para SEO + crawlers.
3. **Server-side rendering con Next.js** (refactor M+L): más correcto pero implica migrar de Vite SPA a Next.js.

**Recomendación: empezar por 1, migrar a 2 cuando haya 10k visits/mes.**

### 1.3 OG Images dinámicas server-side

Cada `/personajes/{slug}` y `/torneos/{slug}` debería tener una **imagen OG generada al vuelo** con datos del personaje (nombre, anime, ELO, foto). Cuando alguien pega el link en Discord/Twitter, se ve un card visual atractivo, no el logo genérico.

**Stack típico:**
- Endpoint Java: `GET /api/og/personaje/{slug}.png` que renderiza un PNG 1200x630 con `Thumbnailator` o `BufferedImage`. Cache 7 días.
- O servicio externo: [Vercel OG](https://vercel.com/docs/og-image-generation) (free tier generoso) o [og.tools](https://og.tools/).

**Esfuerzo:** M (2 días por opción Java casera, 4h con Vercel OG).

### 1.4 Meta description y title únicos por ruta

- Hoy todas las rutas heredan el mismo `<title>AnimeShowdown — Torneos de personajes de anime</title>`.
- Hook `useDocumentTitle` ya cambia el title pero NO cambia `<meta name="description">`.

**Fix:** extender `useDocumentTitle` a `useSeo({ title, description, image })` que setea las 3 cosas.

**Plantillas sugeridas:**
- `/personajes/{slug}`: `"{nombre} de {anime} | ELO {elo} | AnimeShowdown"` + `"Stats, ranking ELO y bracket de {nombre} de {anime}. Vota en torneos cara a cara."`
- `/torneos/{slug}`: `"{nombre} | Bracket de {N} personajes | AnimeShowdown"` + `"Vota o predice el ganador del torneo {nombre} con {N} personajes seleccionados de {animes}."`
- `/animes/{slug}` (cuando exista): `"{anime} | {N} personajes en AnimeShowdown"` + `"Top {N} personajes de {anime} ordenados por ELO. Vota tu favorito."`

### 1.5 Canonical URLs

Para evitar contenido duplicado (mismo personaje accesible vía slug y vía búsqueda), añadir `<link rel="canonical">` apuntando a la URL canónica.

```html
<link rel="canonical" href="https://animeshowdown.dev/personajes/luffy" />
```

### 1.6 Sitemap segmentado

Hoy es un sitemap único de 141 URLs. Para Google Search Console y crawl efficiency, separar:

- `/sitemap.xml` (índice que apunta a los siguientes)
- `/sitemap-static.xml` (8 rutas estáticas: home, personajes, animes, torneos, ranking, votar, higher-or-lower, login/register)
- `/sitemap-personajes.xml` (125 personajes, prioridad 0.6)
- `/sitemap-torneos.xml` (13 torneos, prioridad 0.7)
- `/sitemap-images.xml` (las 125 webps con metadata)

**Modifica:** `scripts/generate-sitemap.mjs`.

### 1.7 Image sitemap

Cada `<url>` puede llevar `<image:image>` con el avatar del personaje. Google indexa eso para Image Search → tráfico extra.

```xml
<url>
  <loc>https://animeshowdown.dev/personajes/luffy</loc>
  <image:image>
    <image:loc>https://animeshowdown.dev/personajes/luffy.webp</image:loc>
    <image:title>Monkey D. Luffy de One Piece</image:title>
  </image:image>
</url>
```

### 1.8 Internal linking strategy

- Cada `/personajes/{slug}` debe linkear a otros 5-10 personajes del mismo anime (ya hay sección "Más de {anime}" parcial).
- Cada `/torneos/{slug}` debe linkear a los personajes participantes y a otros torneos relacionados.
- `/ranking` debe ser hub que linkea a top 50 personajes con anchor text descriptivo.
- Footer con sitemap visible (links a categorías top: Top 10 más populares, Animes con más personajes, Torneos finalizados).

### 1.9 Search Console + Bing Webmaster Tools

Setup obligatorio (1h):

1. **Google Search Console**: añadir propiedad `animeshowdown.dev`, verificar via DNS TXT (Cloudflare lo hace en 30 seg), submit sitemap, esperar 2-4 semanas para indexar.
2. **Bing Webmaster**: mismo proceso con Bing. Captura tráfico residual ~5%.
3. **IndexNow**: protocolo para notificar a buscadores cuando hay contenido nuevo. Se puede integrar en el cron de auto-tournament para que avise a los buscadores instantáneamente.

### 1.10 Core Web Vitals y Lighthouse 90+

Hoy el bundle pesa 187KB gzip + Personaje3D-*.js 235KB gzip lazy. Objetivos:

- **LCP < 2.5s**: optimizar el hero. La aurora puede esperar. Lazy-load FloatingCards.
- **FID/INP < 200ms**: revisar que ningún useEffect bloquea. Service Worker para precache.
- **CLS < 0.1**: ya está bien, pero verificar con Lighthouse Field Data.

**Acciones concretas:**
- Migrar imágenes a AVIF (50% menos peso que webp con misma calidad) con fallback webp.
- Inline el critical CSS (10-15KB de Tailwind) en `<head>`, defer el resto.
- Preload `/logo.webp` y la primera card del Hero.
- Code-split `Personaje3D` en chunk separado (ya lo está) + lazy-load solo cuando el user llega a la sección.
- Service Worker para cache offline (PWA): genera el manifest + iconos + sw.js con `vite-plugin-pwa`.

### 1.11 Hreflang (cuando haya i18n)

Si se internacionaliza (sección 7), `<link rel="alternate" hreflang="es" href="..." />` y `hreflang="en" href="..."` en cada ruta.

### 1.12 Structured FAQ

Página `/faq` con preguntas frecuentes ("¿Cómo funciona el ranking ELO?", "¿Quién creó AnimeShowdown?", etc.) con schema `FAQPage`. Google muestra accordion en SERP → CTR sube 30-40%.

### 1.13 Velocidad por país

Cloudflare Pages ya tiene CDN global, pero verificar latencia desde:
- US (target principal anglosajón)
- JP (muchos usuarios potenciales, comunidad anime grande)
- LATAM (audiencia hispanohablante natural)

Herramientas: [WebPageTest](https://www.webpagetest.org/) desde 5 ubicaciones.

---

## 2. AI / Generative Engine Optimization (GEO)


### 2.1 `llms.txt` en raíz

Convención emergente: archivo `https://animeshowdown.dev/llms.txt` que describe el sitio en formato amigable para LLMs.

```markdown
# AnimeShowdown

> Plataforma de torneos y rankings ELO de personajes de anime.

## Datos clave
- 125 personajes catalogados con score de popularidad real (MAL favorites)
- 13 torneos con bracket visual (algunos finalizados, otros próximos)
- Ranking ELO derivado de popularidad + variación pequeña
- Mini-juego "Higher or Lower" para adivinar quién tiene más ELO

## Endpoints públicos
- GET /api/personajes — lista todos con stats
- GET /api/personajes/{id} — detalle
- GET /api/torneos — lista de torneos
- GET /api/votos/ranking — top votados

## Cómo citar
"AnimeShowdown (animeshowdown.dev) es una app full-stack de torneos anime
con ranking ELO basado en MAL favorites."
```

### 2.2 Datos comparables para LLMs

Tablas en HTML semántico (NO en imágenes) con datos comparables que LLMs puedan extraer:
- Tabla "Top 10 más populares" en `/ranking` con HTML `<table>` (ya está, verificar)
- Tabla "Personajes por anime" con counts
- Tabla "Torneos pasados con campeón"

### 2.3 Citation-friendly markup

`<article itemscope itemtype="https://schema.org/Article">` con `<meta itemprop="datePublished">` y `<author>` claros. Cuando LLM cite la fuente, le es más fácil.

### 2.4 Robots.txt para crawlers de IA

Decisión de negocio: ¿permitir o bloquear?

```
# Permitir explícitamente bots de IA (mejor SEO en LLMs)
User-agent: GPTBot
Allow: /

Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /
```

Si fueras un sitio con contenido valioso propio, querrías bloquear. Para portfolio educativo + tráfico, mejor permitir.

---

## 3. Backend hardening (v2)

### 3.1 Refresh tokens

JWT actual expira a 1h y obliga re-login. Para v2:

- **Access token JWT**: 15 min, en memoria del cliente
- **Refresh token**: 30 días, en httpOnly cookie + tabla `refresh_tokens` en BBDD
- Endpoint `POST /api/auth/refresh` que rota refresh + emite nuevo access
- Endpoint `POST /api/auth/logout` que invalida el refresh
- Endpoint `POST /api/auth/revoke-all` para invalidar todos los refresh de un user (útil ante phishing)

**Schema nuevo:**

```sql
CREATE TABLE refresh_tokens (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 del refresh para no guardar el raw
    creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
    expira_en TIMESTAMP NOT NULL,
    revocado_en TIMESTAMP,
    user_agent TEXT,
    ip_addr INET
);
```

**Esfuerzo:** M (8h dev + tests).

### 3.2 Rate limiting

Hoy `/api/auth/login` y `/api/auth/forgot-password` no tienen límite — un atacante con curl puede hacer brute-force.

**Stack recomendado: Bucket4j + Redis (o caffeine para single-instance).**

```java
@Bean
public Bucket loginRateLimitBucket() {
    return Bucket4j.builder()
        .addLimit(Bandwidth.classic(5, Refill.intervally(5, Duration.ofMinutes(1))))
        .addLimit(Bandwidth.classic(50, Refill.intervally(50, Duration.ofHours(1))))
        .build();
}
```

5 intentos/minuto + 50/hora por IP. Sobrepasar = 429 Too Many Requests con `Retry-After`.

**Aplicar a:**
- `/api/auth/login`
- `/api/auth/registro`
- `/api/auth/forgot-password`
- `/api/auth/reset-password`
- `/api/enfrentamientos/*/votar` (anti-spam de votos)

**Esfuerzo:** S (3h con Bucket4j).

### 3.3 Account lockout temporal

Tras N intentos de login fallidos para un username concreto, lockear 15 min:

```sql
ALTER TABLE usuarios ADD COLUMN intentos_fallidos INT DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN bloqueado_hasta TIMESTAMP;
```

Si `intentos_fallidos >= 5` setea `bloqueado_hasta = NOW() + 15min` y resetea contador. Login mientras bloqueado devuelve 423 Locked.

### 3.4 2FA / TOTP

Para users que quieren extra seguridad, soportar Google Authenticator / Authy:

- Endpoint `POST /api/auth/2fa/setup` que genera secret + QR
- Endpoint `POST /api/auth/2fa/verify` que confirma código TOTP
- Login con 2FA: primer paso devuelve `requires_2fa: true` + token temporal de 60s, segundo paso requiere TOTP

Lib Java: `dev.samstevens.totp:totp:1.7.1`.

**Esfuerzo:** M (10h).

### 3.5 Email verification on signup

Hoy uno se registra y entra. Para v2:

- Tras registro, generar token UUID + guardar en `email_verifications`
- Mandar email vía Resend con link `/verify?token=XXX`
- Hasta que verifique, cuenta está en estado `PENDIENTE` → no puede votar
- Tras verify pasa a `ACTIVO`

Reduce spam de cuentas falsas.

### 3.6 Password complexity

DTO `RegistroRequest` ya valida `@Size(min=6)`. Subir a:

```java
@NotBlank
@Size(min = 8, max = 100)
@Pattern(
    regexp = "^(?=.*[A-Za-z])(?=.*\\d).*$",
    message = "Password debe tener al menos 1 letra y 1 número"
)
private String password;
```

Y mostrar fortaleza en el frontend con [zxcvbn](https://github.com/dropbox/zxcvbn) (4KB gzip).

### 3.7 Audit log de eventos de seguridad

Tabla nueva `audit_log`:

```sql
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    usuario_id BIGINT REFERENCES usuarios(id),
    evento VARCHAR(50) NOT NULL, -- LOGIN_OK, LOGIN_FAIL, REGISTRO, PASSWORD_RESET, ROL_CAMBIADO, etc.
    detalles JSONB,
    ip_addr INET,
    user_agent TEXT
);
```

Spring `@EventListener` + AspectJ para inyectar logging en endpoints de auth. Útil para forense post-incidente.

### 3.8 Migración a Flyway/Liquibase

`spring.jpa.hibernate.ddl-auto=update` no es seguro a largo plazo. Cualquier rename/drop de columna deja BBDD en estado intermedio.

**Migrar a Flyway:**

1. Añadir dep `flyway-core` y `flyway-database-postgresql`
2. Crear baseline `V1__initial.sql` con el schema actual exportado de Neon
3. Cambiar a `spring.jpa.hibernate.ddl-auto=validate`
4. Cada cambio futuro = nuevo `V2__add_refresh_tokens.sql`, etc.

**Esfuerzo:** M (1 día porque hay que validar baseline contra prod).

### 3.9 Database backups automatizados

Neon Free tier tiene branching pero no backups automáticos públicos. Setup:

- GitHub Action diario que hace `pg_dump` y sube a S3 (Cloudflare R2 free tier 10GB)
- Retención: daily 7 días, weekly 4 semanas, monthly 12 meses
- Test de restore mensual obligatorio

```yaml
# .github/workflows/db-backup.yml
on:
  schedule:
    - cron: '0 3 * * *' # 03:00 UTC diario
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - run: |
          pg_dump $DATABASE_URL | gzip > backup-$(date +%F).sql.gz
          aws s3 cp backup-*.sql.gz s3://animeshowdown-backups/
```

### 3.10 Connection pooling tuning

HikariCP default es 10 conexiones. Para Railway free + Neon free hay que vigilar que no se saturen.

```properties
spring.datasource.hikari.maximum-pool-size=10
spring.datasource.hikari.minimum-idle=2
spring.datasource.hikari.connection-timeout=20000
spring.datasource.hikari.idle-timeout=300000
spring.datasource.hikari.max-lifetime=900000
```

Monitorizar via `/actuator/metrics/hikaricp.connections.active` (cuando se exponga actuator metrics).

### 3.11 Caching layer

`/api/personajes` devuelve los 125 cada vez. En burst de tráfico, cachear:

- **Caffeine** (in-memory, single instance Railway): cache de 5 min para `/api/personajes` y `/api/torneos`. Spring `@Cacheable`.
- **Redis** (cuando haya múltiples instancias): cache compartido. Upstash Redis free tier.

**Esfuerzo:** S (2h con Caffeine).

### 3.12 Compresión Brotli

Cloudflare ya hace gzip automático. Brotli (más eficiente) requiere config explícita en Cloudflare Pages → Compression → Brotli enabled.

### 3.13 Asynchronous email queue

Hoy `EmailService.enviarCodigoReset` usa `@Async` con executor por defecto (sin pool, sin retry).

Para v2:

- Pool de threads dedicado para email (5 threads)
- Retry exponential backoff si Resend falla (3 intentos)
- Dead letter queue: si tras 3 retries falla, guardar en tabla `email_failed_queue` y notificar admin

```java
@Async("emailExecutor")
@Retryable(maxAttempts = 3, backoff = @Backoff(delay = 1000, multiplier = 2))
public CompletableFuture<Void> enviarCodigoReset(...) {
    // ...
}
```

### 3.14 WebSocket / SSE para votos en vivo

Hoy `/votar` no muestra resultados en tiempo real. Para v2:

- **Spring WebSocket con STOMP**: endpoint `/ws/torneo/{id}` que pushea actualización cada vez que entra un voto nuevo
- **Cliente**: `@stomp/stompjs` que se suscribe y actualiza el bracket
- Alternativa más simple: **Server-Sent Events** (`@GetMapping(produces = MediaType.TEXT_EVENT_STREAM_VALUE)`) que es unidireccional y suficiente para "stream de votos"

**Esfuerzo:** M (2 días con tests).

### 3.15 API versioning

Cuando cambie el shape de DTOs en breaking ways, soportar `/api/v1/*` (legacy) + `/api/v2/*` (nuevo) durante 6 meses. Header `Accept: application/vnd.animeshowdown.v2+json` también funciona.

### 3.16 OpenAPI spec versionada

Hoy springdoc auto-genera. Para v2: subir el spec a [SwaggerHub](https://swagger.io/tools/swaggerhub/) (free tier) con versionado público — facilita que terceros integren.

### 3.17 GraphQL alongside REST (opcional)

Para clientes que necesiten queries flexibles (mobile apps, BI tools), exponer `/graphql` con `spring-boot-starter-graphql`. No reemplaza REST, complementa.

**Considerar solo si hay clientes terceros pidiendo queries específicas.**

---

## 4. Frontend hardening (v2)

### 4.1 JWT en httpOnly cookies (en lugar de localStorage)

Hoy el JWT vive en `localStorage`, vulnerable a XSS. Para v2:

- Backend setea cookie `Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict; Path=/`
- Frontend ya no maneja el token explícitamente, el navegador lo manda automáticamente con cada request
- CSRF token separado para mitigar (cookie no-httpOnly + header `X-CSRF-Token`)

**Trade-off:** complica el setup para multi-domain (api.dev → app.dev necesita `SameSite=None; Secure`).

### 4.2 PWA + Service Worker

Convertir en Progressive Web App:

```bash
npm i vite-plugin-pwa
```

```ts
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa'
export default {
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo.webp'],
      manifest: {
        name: 'AnimeShowdown',
        short_name: 'AS',
        description: 'Torneos y rankings ELO de personajes anime',
        theme_color: '#ff2e63',
        icons: [/* 192, 512 */],
      },
      workbox: {
        runtimeCaching: [
          { urlPattern: /\/personajes\/.*\.webp$/, handler: 'CacheFirst' },
          { urlPattern: /\/api\/personajes/, handler: 'NetworkFirst', options: { networkTimeoutSeconds: 3 } },
        ],
      },
    }),
  ],
}
```

Beneficios: instalable en móvil/desktop, funciona offline para navegación + cache de imágenes, Lighthouse PWA score 100.

### 4.3 Migración de imágenes a AVIF

WebP da peso bueno, AVIF es ~40% mejor. `<picture>` con fallback:

```html
<picture>
  <source srcset="/personajes/luffy.avif" type="image/avif">
  <source srcset="/personajes/luffy.webp" type="image/webp">
  <img src="/personajes/luffy.jpg" alt="Luffy">
</picture>
```

Generar `.avif` con `cwebp`/`avifenc` en build script.

### 4.4 Responsive images con srcset

Mismo card que se muestra a 200px en grid y a 800px en detail page no necesita la misma resolución. Servir 3 tamaños:

```html
<img srcset="/personajes/luffy-300.webp 300w,
             /personajes/luffy-600.webp 600w,
             /personajes/luffy-1024.webp 1024w"
     sizes="(max-width: 600px) 300px, (max-width: 1200px) 600px, 1024px"
     src="/personajes/luffy-1024.webp"
     alt="Luffy">
```

Modificar `scripts/convert_imgs.sh` para generar 3 tamaños.

### 4.5 Critical CSS inline

Identificar el CSS necesario para LCP (above-the-fold) y meterlo inline en `<head>`. El resto async. Tools: [critters](https://github.com/GoogleChromeLabs/critters) (Vite plugin).

### 4.6 Lazy-load de drei

`Personaje3D` usa `@react-three/drei` (884KB). Ya está code-split. Mejora: solo cargar cuando el user hace scroll a la sección 3D, no inmediatamente al cargar `/personajes/{slug}`.

`React.lazy(() => import('./Personaje3D'))` + Intersection Observer.

### 4.7 Error Boundary global + Sentry

Hoy si una page crashea, React muestra pantalla en blanco. Solución:

- `<ErrorBoundary>` wrapper en `App.jsx` con UI de "Ups, error" + botón "recargar"
- [Sentry](https://sentry.io/) free tier (5k events/mes) que captura excepciones runtime
- Por cada error, Sentry envía email + web dashboard para debug

```bash
npm i @sentry/react
```

```ts
Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, tracesSampleRate: 0.1 })
```

### 4.8 Performance monitoring

Web Vitals API + envío a backend o Plausible:

```ts
import { onCLS, onFID, onLCP } from 'web-vitals'
onCLS(metric => sendToAnalytics(metric))
onFID(metric => sendToAnalytics(metric))
onLCP(metric => sendToAnalytics(metric))
```

Backend o Plausible registra → dashboard de Real User Monitoring.

### 4.9 Accessibility full audit

axe-core en CI:

```bash
npm i -D @axe-core/playwright
```

Test E2E que abre cada ruta y corre axe. Falla CI si hay violations críticas.

Manual:
- Probar navegación 100% por teclado (Tab, Enter, Esc).
- Probar con VoiceOver (Mac) en home, /personajes, /votar.
- Contraste WCAG AAA donde sea posible (los gradient magenta sobre dark a veces no llegan a 4.5:1).

### 4.10 Bundle size budget en CI

Falla el build si el chunk principal supera 200KB gzip:

```yaml
# .github/workflows/build.yml
- run: npm run build
- run: |
    SIZE=$(stat -f%z dist/assets/index-*.js | head -1)
    if [ "$SIZE" -gt 250000 ]; then exit 1; fi
```

---

## 5. Features de producto (v2 functionality)

### 5.1 Real vote-driven brackets ⭐ HIGHEST IMPACT

El refactor M+L que documenté como pendiente. Pasar de:
- Bracket determinístico por ELO local-only
- a Bracket que muestra `enfrentamiento.ganador` real desde backend

**Cambios:**

1. `data/torneos.js` → eliminar (toda la data viene del backend `/api/torneos`)
2. `TorneosPage.jsx` → fetch a `/api/torneos`, loading state, error boundary
3. `TorneoDetailPage.jsx` → fetch a `/api/torneos/{id}` que devuelve enfrentamientos con ganador
4. `Bracket.jsx` → renderiza `enfrentamiento.ganador` (no computa por ELO)
5. `VotarPage.jsx` → llama `/api/enfrentamientos/{id}/votar` real
6. Backend → seedear torneos iniciales en `DataSeeder` o vía cron
7. Frontend → polling cada 30s o WebSocket para refresh

**Esfuerzo:** L (1 semana de trabajo focal).

### 5.2 Live updates via WebSocket / SSE

Después de 5.1, añadir actualización en tiempo real:

- Cuando user A vota, user B viendo el mismo bracket ve la barra de % moverse en <1s
- Notificación toast "Acaba de votar X usuario"

Stack: ya descrito en 3.14.

### 5.3 User profile completo

Card "Tu historial, tu equipo" del bento grid que prometía pero no implementaba. Para v2:

- `/perfil` con tabs:
  - **Stats**: total votos emitidos, predicciones acertadas, % acierto
  - **Historial**: últimos 50 votos con fecha + enfrentamiento + qué eligió
  - **Tu top 5**: personajes más votados por este user
  - **Logros**: badges desbloqueados (sección 5.7)
  - **Avatar**: editor con upload + URL (ya hecho)

### 5.4 Friends / follow system

Tabla `seguidores`:

```sql
CREATE TABLE seguidores (
    seguidor_id BIGINT REFERENCES usuarios(id) ON DELETE CASCADE,
    seguido_id BIGINT REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha_inicio TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (seguidor_id, seguido_id),
    CHECK (seguidor_id != seguido_id)
);
```

UI:
- Botón "Seguir" en perfiles de otros users
- Feed en `/inicio` con votos recientes de los users que sigues
- Notificaciones (in-app o por email opt-in) cuando alguien que sigues vota en un torneo

### 5.5 Leaderboards segmentados

Hoy `/ranking` es un solo top. Añadir filtros:

- Por anime (ej. "Top Naruto")
- Por género del personaje (filtro `genero` que hay que añadir al model)
- Por época del anime (años 90, 2000s, modernos)
- Top mensual (votos del mes en curso)
- Top all-time

UI: tabs en `/ranking` con filtros.

### 5.6 Predicciones de torneos

Antes de que un torneo arranque, users pueden predecir el ganador de cada match. Cuando se resuelve, gana puntos.

```sql
CREATE TABLE predicciones (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT REFERENCES usuarios(id),
    enfrentamiento_id BIGINT REFERENCES enfrentamientos(id),
    personaje_predicho_id BIGINT REFERENCES personajes(id),
    fecha TIMESTAMP DEFAULT NOW(),
    acertada BOOLEAN, -- null hasta que el match se resuelve
    UNIQUE (usuario_id, enfrentamiento_id)
);
```

UI:
- Página `/torneos/{id}/predicciones` con form
- Leaderboard de "Mejores predictores del mes"
- Badge "Profeta" tras N aciertos consecutivos

### 5.7 Achievements / badges

Tabla `logros`:

```sql
CREATE TABLE logros (
    id VARCHAR(50) PRIMARY KEY, -- 'primer_voto', 'cien_votos', 'profeta_3', etc.
    nombre VARCHAR(100),
    descripcion TEXT,
    icono VARCHAR(50), -- nombre del icono lucide-react
    raro BOOLEAN -- si es legendary
);

CREATE TABLE usuario_logros (
    usuario_id BIGINT REFERENCES usuarios(id),
    logro_id VARCHAR(50) REFERENCES logros(id),
    desbloqueado_en TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (usuario_id, logro_id)
);
```

Catálogo inicial:
- `primer_voto` (votar 1 vez)
- `cien_votos` (votar 100 veces)
- `mil_votos` (votar 1000 veces)
- `voto_minoritario` (votar al perdedor con <30% de votos en un match)
- `predicciones_3_seguidas`, `predicciones_10_seguidas`
- `torneo_completo` (votar en TODOS los matches de un torneo)
- `cazador_villanos` (votar al villano en N matches)
- `fanboy_anime_X` (votar mayoritariamente personajes de un solo anime)

Backend con `@EventListener` que escucha eventos de voto y desbloquea badges. Toast Sonner cuando se desbloquea + sonido `playLevelUp`.

### 5.8 Comments en personajes y torneos

Sistema simple de comentarios:

```sql
CREATE TABLE comentarios (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT REFERENCES usuarios(id),
    personaje_id BIGINT REFERENCES personajes(id), -- null si es de torneo
    torneo_id BIGINT REFERENCES torneos(id), -- null si es de personaje
    texto TEXT NOT NULL CHECK (length(texto) <= 500),
    fecha TIMESTAMP DEFAULT NOW(),
    oculto BOOLEAN DEFAULT FALSE -- soft delete por moderación
);
```

UI:
- Sección "Comentarios" al final de `/personajes/{slug}` y `/torneos/{slug}`
- Paginación (20/página)
- Botón "Reportar" → marca como `reportado`, admin revisa
- Filtro de palabras (lista en `application.properties` + bad-words lib)

### 5.9 Reactions (likes en comentarios)

Como Twitter: 4 reacciones por comentario (👍 ❤️ 😂 😢). Tabla:

```sql
CREATE TABLE reacciones (
    comentario_id BIGINT REFERENCES comentarios(id) ON DELETE CASCADE,
    usuario_id BIGINT REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL, -- 'like', 'love', 'lol', 'sad'
    PRIMARY KEY (comentario_id, usuario_id)
);
```

### 5.10 Torneos creados por users (creator economy)

Users con cuenta verificada (sección 3.5) pueden crear torneos:
- 8 o 16 personajes que ellos elijan
- Tema/título personalizado
- Visibilidad pública o solo amigos
- Tras crear queda en cola, admin aprueba en <24h, se publica

Esto es **el feature que más engagement genera** en sites de polls (ver TierMaker, Smash.gg). Si lo ves rentable, dedicar mes 4 entero.

### 5.11 Recommendations (collaborative filtering)

"Personas que votaron a Luffy también votaron a..." → ML básico:

- Matriz user × personaje, valor 1 si votó, 0 si no
- Cosine similarity entre vectores
- Para cada user, calcular top 5 vecinos y recomendar personajes que ellos votaron y este no

Stack: Java tiene libs como Apache Mahout, pero más simple es Python con scikit-learn ejecutado offline 1 vez/día → cachear top 5 recommendations en BBDD por user.

### 5.12 Búsqueda mejorada

Hoy `cmdk` hace fuzzy básico. Para v2:

- **Algolia free tier** (10k searches/mes): index los 125 personajes con peso por popularidad. Devuelve typo-tolerance + ranking inteligente.
- O **Meilisearch self-hosted** (gratis, 1 instancia Railway): mismo resultado, ownership pleno.

Frontend: cambiar `cmdk` por `react-instantsearch-hooks-web` (Algolia).

### 5.13 Newsletter

Captar emails para anunciar nuevos torneos:

- Form en footer con `react-hook-form` → POST a backend
- Backend guarda en tabla `newsletter_subs` con confirmación double opt-in (email con link de confirm)
- Endpoint `/api/admin/newsletter/send` que manda email a todos via Resend (max 100/día en free tier, 1000/día en Pro $20/mes)

Lib alternativa: [ConvertKit](https://convertkit.com/) gratis hasta 1000 subs.

### 5.14 i18n ES/EN/JP

`react-i18next`:

```bash
npm i react-i18next i18next i18next-browser-languagedetector
```

Archivos `/locales/es.json`, `/locales/en.json`, `/locales/ja.json` con todas las strings UI.

Backend: descripciones de personajes en 3 idiomas → tabla `personaje_descripciones (personaje_id, idioma, descripcion)`. Endpoint devuelve según `Accept-Language`.

Toggle de idioma en el header.

**Esfuerzo:** L (2 semanas con traducciones decentes).

---

## 6. Cuentas de redes sociales y community

La comunidad anime vive en estos sitios. Sin presencia ahí, el sitio depende solo de SEO.

### 6.1 Cuentas a abrir (orden de prioridad)

| Plataforma | Por qué | Frecuencia ideal | Coste tiempo |
|---|---|---|---|
| **Discord server** | Comunidad anime es Discord-first. Server propio = retención brutal | Daily (just be there) | 2h/día |
| **X/Twitter** `@AnimeShowdown` | Donde se discute anime. Threads de "top de la semana", encuestas, hot takes | 3-5 posts/semana | 30min/post |
| **Instagram** `@animeshowdown.dev` | Cards visuales del top, art de los personajes. Buen alcance algorítmico para visuales | 2-3 posts/semana | 1h/post |
| **Reddit** post en r/anime, r/animenews | Posts orgánicos con threads de "we made an ELO ranking of 125 chars" cuando lances v2 | 1 post/mes | 2h/post |
| **TikTok** `@animeshowdown` | Anime audience joven. Videos de 15s "Top 10 most popular anime characters". Algoritmo brutal de alcance | 1 video/semana | 2-3h/video |
| **YouTube channel** | Long-form retrospectives ("Why Luffy is #1") | 1 video/mes | 1 día/video |

### 6.2 Estrategia de contenido

**Pilares de contenido (4 tipos en rotación):**

1. **Rankings semanales**: "Top 5 más votados esta semana" — generado automático por cron, posteado a Discord/Twitter
2. **Hot matchups**: "¿Quién ganaría: Luffy vs Naruto?" — engagement bait honesto, deriva tráfico al torneo
3. **Behind the scenes**: snippets técnicos del proyecto, tipo "Cómo escalamos el ranking ELO a 125 personajes" (audiencia técnica + cred)
4. **Comunidad**: spotlight de comentarios graciosos, fan art de users (con permiso), cumpleaños de personajes

### 6.3 Discord — diseño del server

Canales:
- `#welcome` con reglas + roles
- `#anuncios` (admin only)
- `#general` charla libre
- `#torneos-activos` thread por torneo
- `#predicciones` para predictores
- `#fan-art` con bot que limita a 1 post/día por user
- `#feedback` bug reports + sugerencias
- `#bot-spam` para evitar contaminar generales

Roles:
- `@Verificado` (cuenta confirmada en la web)
- `@Top Predictor` (auto desde la API)
- `@Beta Tester` (acceso early a v2)
- `@Admin`

Bot custom (Discord.js + tu propia API):
- Comando `/voto <personaje>` para votar desde Discord
- Comando `/ranking` para ver top 10 actual
- Auto-anuncia cuando arranca o termina un torneo

### 6.4 Twitter content schedule

Lunes: Top semanal del ranking
Miércoles: "Hot take" (frase polémica + thread de 5 tweets)
Viernes: Sneak peek del torneo del fin de semana
Domingo: Cierre + predicciones lectores

Herramientas: [Buffer](https://buffer.com/) free tier programa hasta 10 posts/cuenta.

### 6.5 Anime conventions / IRL presence

Si en algún momento queréis ir a:
- **Japan Weekend** Madrid/Barcelona
- **Salón del Manga** Barcelona
- **Tokyo Game Show** o **Anime Expo** (LA)

Llevar:
- QR card con `animeshowdown.dev`
- Stickers de los personajes top (legal por ser educativo, pero respetar copyright en venta)
- Tablet con el sitio para enseñar live

Genera tracción enorme con base de seguidores fan.

### 6.6 Influencer outreach

Lista de YouTubers/Twitch streamers de anime hispanos (Mighty Knight, Mister Charl, Javitops, etc.) que podrían hacer un video o stream usando AnimeShowdown como herramienta. Email frío con propuesta clara: "Te mando el contacto del admin para que crees torneos custom para tus subs."

---

## 7. Integraciones externas

### 7.1 OAuth login (Google, Discord, MAL, GitHub)

Hoy solo username+password. Para v2:

- **Google OAuth** (90% de users tiene Google account, fricción 0)
- **Discord OAuth** (audiencia objetivo nativa)
- **MyAnimeList OAuth** (acceso a su lista de favoritos → personalización inicial)
- **GitHub OAuth** (audiencia técnica del repo)

Spring Security tiene `spring-security-oauth2-client` que lo hace casi automático. Frontend: botones en `/login` con cada provider.

### 7.2 Jikan API integration profunda

Hoy se usa para popular bio en `/personajes/{slug}` (parcial). Extender:

- Ratings reales de animes desde Jikan (filtrar/ordenar por rating)
- Voice actor info en perfil de personaje
- "Personajes similares" (por tags Jikan)
- Background art de animes en hero de cada anime

### 7.3 AniList GraphQL API

Alternativa a Jikan, datos mejor estructurados. Endpoint público, sin API key.

```graphql
query ($search: String) {
  Character(search: $search) {
    name { full }
    image { large }
    description
    favourites
  }
}
```

Útil para validar/actualizar el mapa POPULARIDAD automáticamente cada N meses (cron job).

### 7.4 Crunchyroll affiliate program

Crunchyroll tiene programa de afiliados (Impact / CJ.com). Cuando un user llega a `/personajes/luffy`, footer dice "Mira One Piece en Crunchyroll" con link tracked. 5-10% de comisión por nueva subscripción.

Setup: registrarse en Impact, crear tracking links por anime, integrar en el frontend con un map `anime → crunchyroll_url`.

### 7.5 Spotify embed

Cada `/animes/{slug}` puede tener embed del opening del anime (Spotify free embed, 30s preview). Engagement +.

### 7.6 Twitter OG share intent

Botón "Compartir" en `/personajes/{slug}` que genera link tipo:

```
https://twitter.com/intent/tweet?text=Mi%20personaje%20favorito%20de%20{anime}%20es%20{nombre}&url=https://animeshowdown.dev/personajes/{slug}
```

Mismo para Reddit, WhatsApp, Telegram, Bluesky.

### 7.7 Email marketing (Mailchimp / ConvertKit)

Cuando newsletter tenga >100 subs, migrar de Resend ad-hoc a tool dedicada:

- Templates HTML responsive
- Segmentación por interés (users que votan más de X anime → newsletter de ese anime)
- A/B testing de subject lines
- Reports de open/click rate

ConvertKit gratis hasta 1000 subs.

### 7.8 Plausible Analytics

Privacy-friendly, GDPR-compliant, no usa cookies, **20$/mes para tu sitio o self-hosted free**:

- Eventos custom: voto emitido, login, registro, share
- Funnels: home → personajes → personaje detalle → vote
- Goal: % de visitantes que terminan votando

Ventaja sobre Google Analytics: no necesitas cookie banner.

### 7.9 UptimeRobot / BetterStack

Monitor externo gratis pingeando `/actuator/health` cada 5 min. Notifica por email/Discord webhook si cae.

```
Monitor URL: https://api.animeshowdown.dev/actuator/health
Method: GET
Expected: status: UP
Interval: 5 min
Notification: email + Discord webhook
```

### 7.10 Cloudflare Turnstile (captcha)

Si rate limiting no es suficiente contra bots, añadir [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) (alternativa gratis a reCAPTCHA, sin tracking) en `/registro` y `/login`.

---

## 8. Monetización (si aplicara)

Opciones por orden de menos invasivo a más:

### 8.1 Donaciones (Patreon / Ko-fi / Buy Me a Coffee)

Botón "Apoya el proyecto" en footer + página `/apoya`. Sin reciprocidad obligatoria, solo gratitud.

Ko-fi gratis, sin comisión. Patreon 5-12% de comisión pero tiene tiers gestionados.

### 8.2 Premium tier

$3/mes da acceso a:

- Crear torneos custom (sección 5.10)
- Estadísticas avanzadas en `/perfil`
- Avatar animado (lottie / video)
- Sin "Sugiere personaje" CTA (banner removido)
- Insignia "Supporter" visible en perfil

Stripe Checkout para procesarlo. ~5% de comisión.

### 8.3 Affiliate links

Crunchyroll, Funimation, AnimePlanet store. Honesto y útil — cuando user busca "Luffy" naturalmente quiere ver One Piece.

### 8.4 Sponsored torneos

Marca de merchandising paga para que un torneo lleve su nombre y logo durante 1 semana. ~50€/torneo. Solo si hay tráfico real (>10k uniques/mes).

### 8.5 Banner ads

**No recomendado.** Audiencia anime es alérgica a ads, AdBlock penetration ~80%. Romper UX por ingresos bajos no compensa.

### 8.6 Merchandising oficial

Camisetas, posters, stickers de un "AnimeShowdown branded" no de personajes (legal con copyright). Print-on-demand vía Printful / Teespring.

---

## 9. Infraestructura y mantenimiento

### 9.1 CI/CD pipelines completas

Hoy hay 1 GitHub Action (auto-tournament). Añadir:

```yaml
# .github/workflows/ci.yml
on: [push, pull_request]
jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { java-version: '21' }
      - run: ./mvnw test

  frontend-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: cd frontend && npm ci && npm run build && npm run lint

  e2e-playwright:
    runs-on: ubuntu-latest
    steps:
      - run: cd e2e && npx playwright test

  smoke-test:
    runs-on: ubuntu-latest
    needs: [backend-tests, frontend-build]
    if: github.ref == 'refs/heads/main'
    steps:
      - run: bash scripts/smoke-test.sh
```

### 9.2 Dependabot

`.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule: { interval: "weekly" }
    open-pull-requests-limit: 5
  - package-ecosystem: "maven"
    directory: "/backend"
    schedule: { interval: "weekly" }
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule: { interval: "weekly" }
```

Auto-merge para patches de minor que pasan CI. Major updates manual.

### 9.3 Snyk / Mend security scanning

Free tier de Snyk corre en cada PR, falla CI si hay CVE crítico en dependencias.

### 9.4 Sentry para runtime errors

Ya descrito en 4.7.

### 9.5 Logging centralizado

Hoy logs están en Railway. Para v2 con múltiples servicios, agregarlos:

- **Logtail** (Better Stack) free 1GB/mes
- **Grafana Cloud** free tier
- **AWS CloudWatch** si migráis a AWS algún día

Logs estructurados JSON (sección 3.7 audit log + Logback JSON encoder).

### 9.6 CDN beyond Cloudflare

Cloudflare Pages está bien para el HTML/JS. Para imágenes (las 125 webps) considerar:

- **Bunny CDN**: $1/mes, latencia más baja en LATAM/JP
- **ImageKit.io** free tier: optimización on-the-fly + transformación dinámica

### 9.7 Disaster recovery plan

Documento con runbook concreto:

- Si Railway cae: reload desde docker hub a Render free tier (1h downtime)
- Si Neon corrompe: restore desde último backup S3 (4h downtime)
- Si Cloudflare DNS cae: switch DNS a Namecheap como secondary (~30min)
- Contacto de emergencia: tu email + número de teléfono

### 9.8 Load testing

Cuando v2 esté lista, simular 1000 usuarios concurrentes:

```bash
# k6 script
import http from 'k6/http'
export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '2m', target: 1000 },
    { duration: '30s', target: 0 },
  ],
}
export default function() {
  http.get('https://api.animeshowdown.dev/api/personajes')
  http.get('https://api.animeshowdown.dev/api/torneos')
}
```

Identificar cuellos: BBDD, JVM heap, CPU. Tunear según.

### 9.9 A/B testing framework

Cuando haya >5k usuarios/mes:

- [GrowthBook](https://www.growthbook.io/) self-hosted
- [Statsig](https://statsig.com/) free 1M events/mes

Test ideas:
- Color del CTA del Hero (magenta vs cyan)
- Longitud de la descripción de personaje (corta vs larga)
- Orden default en /personajes (popularidad vs ELO)

### 9.10 Feature flags

[LaunchDarkly](https://launchdarkly.com/) free 1k users o [Unleash](https://www.getunleash.io/) self-hosted.

```ts
if (useFeatureFlag('higher-or-lower-v2')) {
  // nueva versión con animaciones extra
}
```

Útil para deploy continuo sin riesgo: lanzas con flag OFF, activas para 5% de users, monitorizas métricas, luego rollout 100%.

---

## 10. Mantenimiento periódico

### 10.1 Calendario semanal

- **Lunes**: revisar Sentry → triagear errores nuevos
- **Miércoles**: revisar PRs de Dependabot → merge los safe
- **Viernes**: revisar feedback de Discord + crear issues GitHub

### 10.2 Calendario mensual

- Lighthouse contra las 5 rutas top → comparar con baseline → fixear regresiones
- Revisar logs Railway → patrones de error
- Backup test: descargar último S3 backup, restorearlo en local, verificar integridad
- Update deps majors si hay nuevas estables (>6 meses en stable)

### 10.3 Calendario trimestral

- Revisar mapa POPULARIDAD (los nuevos animes salen, popularidades cambian)
- Auditar contenido: ¿hay personajes mal etiquetados? ¿descripciones desactualizadas?
- Revisar SEO: ¿el sitio sale en top 5 para "torneos anime"? ¿qué keywords están subiendo/bajando?
- Performance audit completo

### 10.4 Calendario anual

- Renovar dominio (auto si Cloudflare lo tiene en auto-renew)
- Renovar Resend / cualquier servicio paid
- Penetration test externo (Hacken o similar, $500-1k)
- Año-en-revisión post para Discord/Twitter

---

## 11. Métricas y analítica

### 11.1 KPIs principales

| Métrica | Definición | Target v2 |
|---|---|---|
| MAU | Monthly Active Users (login en últimos 30 días) | 5k |
| Retention D1/D7/D30 | % users que vuelven 1/7/30 días tras primer login | 30% / 15% / 8% |
| Votos/sesión | Votos emitidos por sesión promedio | 8 |
| Conversion signup | % visitors que se registran | 3% |
| LTV | Ingreso promedio por user (premium tier) | 5€ |

### 11.2 Eventos custom

Trackear con Plausible:

- `signup_completed`
- `login_success`
- `vote_cast` (con anime + personaje como props)
- `tournament_view`
- `share_clicked` (con plataforma)
- `premium_upgrade`

### 11.3 Funnels

- **Adquisición → Activación**: visitor → signup → first vote
- **Engagement**: first vote → 10 votes → daily user
- **Monetización**: daily user → premium upgrade

Cada funnel = dashboard en Plausible.

### 11.4 Cohort analysis

Plausible no lo da gratis. Para ello:

- Dump diario de `usuarios + votos` a CSV
- Notebook Jupyter mensual: cohort retention curves
- Si te lo tomas en serio, [Mixpanel](https://mixpanel.com/) free 100k events.

---

## 12. Legal y compliance

### 12.1 Privacy Policy

Obligatoria si tienes users en EU/UK (GDPR). Plantillas:

- [Termly](https://termly.io/) free generator
- [iubenda](https://www.iubenda.com/) (paid pero más completo)

Cubrir: qué datos se recogen, finalidad, base legal, retención, derechos del user, contacto DPO (= tú).

### 12.2 Terms of Service

Mismas opciones. Cubrir: aceptación, conducta prohibida, propiedad intelectual de personajes (disclaimer educativo), limitación de responsabilidad, jurisdicción.

### 12.3 Cookie consent banner

Si usas Plausible (no usa cookies) y no GA, **no necesitas banner**. Si usas GA o Sentry session replay, sí.

### 12.4 DMCA process

Email `dmca@animeshowdown.dev` y página `/dmca` con instrucciones para retirar contenido por infracción de copyright. Importante: si recibes takedown notice, retirar en 24h o pierdes el safe harbor.

### 12.5 Email opt-in/out (CAN-SPAM + GDPR)

Cada email de Resend debe tener:
- Footer con `Unsubscribe` link
- Endpoint `/api/unsubscribe?token=XXX` que marca `usuarios.email_opt_out=true`
- Backend respeta el flag, no manda emails marketing al user

---

## 13. Marketing y lanzamiento de v2

### 13.1 Pre-lanzamiento (2 semanas antes)

- Discord server abierto, primeros 100 invites a comunidades anime de tu network
- Post de "behind the scenes" en Reddit r/SideProject, r/AnimeMemes con disclaimer claro
- Mail a influencers con preview privado

### 13.2 Día del lanzamiento

- **ProductHunt**: post a las 00:01 PST (mejor algoritmo). Asset + GIF + descripción
- **Hacker News**: "Show HN: AnimeShowdown — full-stack with custom domain, real popularity rankings, ELO-driven brackets"
- **Reddit**: r/anime con thread "We made an ELO ranking of 125 anime characters using real MAL favorites data"
- **Twitter**: thread de 8-10 tweets con screenshots + tech stack
- **Discord**: anuncio masivo en tu server + cross-post a otros servers anime con permiso

### 13.3 Post-lanzamiento (semana 1)

- Responder cada comentario en HN/PH/Reddit (importante, generan más visibilidad)
- Si llega tracción real, entrevistas en pods de tech / anime
- Publicar métricas reales day 7 ("X users, Y votes, Z torneos") — transparencia genera más interés

### 13.4 Content marketing constante

- Blog en `/blog` con artículos:
  - "Cómo escalamos el ranking ELO a 125 personajes" (técnico, audiencia dev)
  - "Por qué Levi y Luffy lideran el top global de MAL desde 2015" (anime, audiencia fan)
  - "Diferencias entre el bracket de AnimeShowdown y los polls de Crunchyroll" (comparativa)
- Cada post optimizado para SEO con keyword research previa (Ahrefs free)

---

## 14. Roadmap timeline sugerido

Asumiendo dedicación part-time (10h/semana):

### Mes 1-2: SEO + critical backend
- Schema.org JSON-LD ✅
- OG dynamic + meta unique ✅
- Search Console + Bing Webmaster ✅
- Refresh tokens ✅
- Rate limiting ✅
- Migración Flyway ✅
- Lighthouse 90+ todas las rutas ✅

### Mes 3-4: Vote-driven backend wiring
- Frontend lee de `/api/torneos` ✅
- VotarPage llama backend ✅
- Bracket muestra ganador real ✅
- WebSocket / SSE para updates ✅
- Polling fallback ✅

### Mes 5-6: Community features
- Comments + reactions ✅
- Predicciones ✅
- Achievements / badges ✅
- User profile completo ✅
- Discord server lanzado + bot ✅

### Mes 7-8: Polish + premium
- 2FA / TOTP
- Email verification
- Audit log
- PWA + Service Worker
- AVIF + responsive images
- Premium tier con Stripe

### Mes 9-10: Lanzamiento v2
- Pre-launch comms ✅
- Día D coordinated ✅
- Post-launch firefighting ✅
- Tracking de métricas ✅

### Mes 11-12: Iteración basada en datos
- A/B tests
- Funnel optimizations
- i18n EN/JP
- Mobile app (React Native, opcional)

---

## 15. Anti-patterns a evitar

Cosas que parecen buena idea pero no lo son:

- **WebSocket sin necesidad real**: si no hay >100 users concurrentes en el mismo torneo, polling cada 30s basta y es 10x más simple
- **GraphQL sin clientes terceros**: REST + OpenAPI cubre 95% de casos, GraphQL añade complejidad para el 5% restante
- **Microservicios prematuros**: AnimeShowdown es un monolito. Mantenerlo como tal hasta >100k MAU
- **Reescritura completa**: cada vez que pienses "habría que migrar a Next.js" o "esto en Rust sería mejor", recuerda que costaría 2 meses sin valor para el usuario
- **Más libs**: cada `npm i` es un compromiso. Pregúntate "¿podría con `useState` lo que hace esta lib?"
- **Premature optimization**: no preocuparse de rendimiento hasta que un user real se queje
- **Feature creep**: cada feature tiene coste de mantenimiento perpetuo. Decir NO es la habilidad clave

---

## 16. Recursos y referencias

### Stack actual
- [Spring Boot Reference](https://docs.spring.io/spring-boot/docs/current/reference/html/)
- [React 19 Docs](https://react.dev/)
- [Vite Docs](https://vitejs.dev/)
- [Tailwind v4](https://tailwindcss.com/)
- [Cloudflare Pages](https://developers.cloudflare.com/pages/)
- [Railway Docs](https://docs.railway.app/)
- [Resend Docs](https://resend.com/docs)

### SEO
- [Google Search Central](https://developers.google.com/search)
- [Schema.org](https://schema.org/)
- [Web Vitals](https://web.dev/vitals/)

### Security
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Spring Security Reference](https://docs.spring.io/spring-security/reference/)
- [JWT Best Practices RFC 8725](https://datatracker.ietf.org/doc/html/rfc8725)

### Community
- [r/SideProject](https://reddit.com/r/SideProject)
- [Indie Hackers](https://www.indiehackers.com/)
- [ProductHunt](https://www.producthunt.com/)

---

## 17. Compromiso mínimo para considerar v2 "lanzada"

Si solo haces 8 cosas de este doc, que sean estas:

1. **Vote-driven backend wiring** (sección 5.1) — cierra el bug visual del bracket vs estado
2. **Schema.org JSON-LD + OG dinámico** (1.1, 1.2) — Google indexa serio
3. **Refresh tokens** (3.1) — sin re-login horario
4. **Rate limiting** (3.2) — bloquea brute-force
5. **Migración Flyway** (3.8) — schema seguro a futuro
6. **PWA + Service Worker** (4.2) — instalable, offline, Lighthouse PWA 100
7. **Discord server** (6.3) — la única forma de retener users de anime
8. **Sentry + UptimeRobot** (4.7, 7.9) — operability básica

Eso es ~6 meses part-time. Todo lo demás es polish o crecimiento.

---

**Última actualización:** 2026-05-10 — al cierre de la v1.
**Owner:** Diego Gil ([@diegoalegil](https://github.com/diegoalegil)).
**Status del proyecto:** v1 en producción, plan v2 sin ejecutar todavía.
