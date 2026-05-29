# AnimeShowdown - Architecture

AnimeShowdown es una plataforma full-stack para duelos 1v1, ranking competitivo,
torneos, juegos diarios, perfiles publicos y contenido SEO alrededor del
catalogo anime. La arquitectura prioriza una experiencia frontend rapida,
visual y resiliente, con una API Spring Boot que centraliza datos persistentes,
auth, votos, torneos y observabilidad.

## 1. Stack

### Frontend

| Area | Tecnologia |
|---|---|
| Runtime UI | React 19 |
| Router | React Router 7 |
| Build | Vite 8 |
| Estilos | Tailwind CSS v4 con tokens en `frontend/src/index.css` |
| Animacion | Framer Motion |
| Data fetching | TanStack Query |
| Forms | react-hook-form |
| Feedback | Sonner, Web Audio API |
| PWA | vite-plugin-pwa + Workbox |
| Observabilidad | Sentry + Web Vitals |
| E2E | Playwright |

### Backend

| Area | Tecnologia |
|---|---|
| Runtime | Java 21 |
| Framework | Spring Boot 3.5 |
| API | Spring Web + Validation + springdoc-openapi |
| Seguridad | Spring Security + JWT + refresh cookie httpOnly |
| Datos | PostgreSQL + Spring Data JPA |
| Migraciones | Flyway |
| Tiempo real | WebSocket STOMP |
| Cache/resiliencia | Caffeine, Resilience4j, Actuator |
| Tests | JUnit 5, MockMvc, H2 |

### Infraestructura

| Servicio | Uso |
|---|---|
| Cloudflare Pages | Frontend, redirects, headers, PWA assets |
| Railway | Backend Spring Boot |
| Supabase | PostgreSQL |
| Cloudflare/R2 compatible | Catalogo de imagenes y assets pesados |
| GitHub Actions | Validacion, jobs manuales y mantenimiento |

## 2. Estructura de capas

```text
AnimeShowdown/
├── frontend/
│   ├── src/
│   │   ├── pages/          # Rutas de producto
│   │   ├── components/     # UI reutilizable y visual system
│   │   ├── hooks/          # Queries y hooks de UX
│   │   ├── lib/            # API client, SEO, schema, helpers
│   │   ├── contexts/       # Auth, sonido y estado transversal
│   │   ├── data/           # Config editorial local
│   │   └── locales/        # i18n
│   ├── img/                # Fuente visual versionada del catalogo
│   └── public/             # PWA, SEO, redirects y headers
├── backend/
│   └── src/main/java/com/diegoalegil/animeshowdown/
│       ├── controller/     # REST, Swagger, WebSocket entrypoints
│       ├── service/        # Dominio y reglas de negocio
│       ├── repository/     # JPA repositories
│       ├── model/          # Entidades persistentes
│       ├── dto/            # Contratos API
│       ├── config/         # Security, CORS, async, seed
│       └── security/       # JWT, rate limit, proxy, auth helpers
├── scripts/                # Sitemap, assets, sync y QA
└── docs/                   # Runbooks, planes y documentacion publica
```

## 3. Fronteras principales

### Frontend shell

`frontend/src/main.jsx` inicializa Sentry, Web Vitals, stale asset recovery,
React Router, TanStack Query y providers globales. `frontend/src/App.jsx`
centraliza rutas lazy, chrome global, preloads por hover/idle y el gate del
catalogo de personajes.

Las rutas publicas de soporte, auth, legal y status no dependen del catalogo.
Las rutas de producto principales si pasan por `RequireCatalog` para evitar
pantallas incompletas cuando el backend todavia no entrego personajes.

### API client y queries

`frontend/src/lib/api.js` define los endpoints y el manejo de access token en
memoria. Los hooks de `frontend/src/hooks/` encapsulan queries de TanStack
Query, deduplicacion, cache y polling cuando aplica.

La regla general es que las paginas no construyan fetches a mano si ya existe
un helper o hook de dominio.

### Backend controllers

Los controllers convierten HTTP/WebSocket en operaciones de dominio. Deben
mantener contratos estables para el frontend y delegar reglas no triviales a
services. Los DTOs viven separados de las entidades para no exponer detalles de
persistencia.

### Services

La logica de votos, torneos, auth, logros, notificaciones, OG images y
observabilidad vive en services. Esta capa es el sitio correcto para reglas de
negocio, deduplicacion, auditoria y validaciones que no pertenecen a un solo
controller.

### Persistencia

Flyway gobierna el schema. Las migraciones desplegadas son inmutables; cualquier
cambio nuevo entra como version nueva. En tests se usa H2 con perfil aislado
cuando conviene, pero los contratos deben seguir pensando en PostgreSQL.

## 4. Decisiones clave

### Catalogo versionado

El catalogo visual parte de `frontend/img/` y se sincroniza con seeds y helpers
mediante scripts. El frontend puede usar datos locales como fallback, pero la
API es la fuente viva para votos, torneos, perfiles y actividad.

### Ranking y ELO

AnimeShowdown usa "ELO" como lenguaje de producto competitivo. Hay dos fuentes
que conviven:

- ELO base local para ordenar y enriquecer vistas cuando el backend aun no ha
  enviado actividad suficiente.
- Rankings de votos reales desde backend para historico, mes, anime y
  movimiento reciente.

Los torneos no deben mantener una verdad paralela del resultado: el bracket se
deriva de enfrentamientos, votos y propagacion controlada de ganadores. Si se
ajusta el modelo competitivo, hay que preservar coherencia entre REST,
WebSocket, ranking visual y detalle de torneo.

### Auth

El access token JWT vive en memoria del cliente. La persistencia de sesion se
hace con refresh token en cookie `httpOnly`, `Secure` en produccion y
`SameSite=Lax`. El frontend hidrata sesion llamando a `/api/auth/refresh` y el
backend rota refresh tokens para limitar reuse.

OAuth escribe refresh cookie en backend y redirige a `/auth/callback`; esa ruta
solo pide un access token fresco y reconstruye el estado React.

### Imagenes y R2

El artefacto de Cloudflare Pages no debe cargar todo `frontend/img/`. En
produccion `build:no-images` genera redirects `/img/*` hacia el origen externo
configurado por `ANIMESHOWDOWN_IMG_CDN_BASE_URL`. La subida a R2/S3 compatible
se ejecuta con scripts y secretos `R2_IMG_*`.

Las referencias a assets deben apuntar a archivos existentes o pasar por
fallbacks controlados como `AssetFallback` y `PersonajeImg`.

### SEO y OG

La app sigue siendo SPA, pero mantiene sitemap, robots, canonical, JSON-LD y OG
dinamicas. Las rutas masivas o privadas no se indexan. Los metadatos por ruta
se gestionan desde hooks y helpers de schema para evitar duplicacion.

### Observabilidad

Sentry se inicializa solo si existe DSN. Web Vitals se reportan como
measurements. El `ErrorBoundary` global evita pantalla blanca y captura errores
sin exponer stacktrace en produccion. Los eventos se filtran antes de salir para
reducir riesgo de datos sensibles.

## 5. Flujos criticos

### Votar 1v1

1. El frontend obtiene catalogo y arma una pareja valida o consume pareja del
   backend si la ruta lo requiere.
2. El usuario elige ganador con click o teclado.
3. El frontend envia voto anonimo o autenticado.
4. El backend valida deduplicacion, limite y captcha si aplica.
5. La UI muestra feedback inmediato y prepara el siguiente duelo.
6. Ranking, misiones, logros y actividad se actualizan por queries o eventos.

### Login y refresh

1. Login o OAuth entrega sesion backend.
2. Backend emite JWT corto y refresh cookie.
3. Frontend guarda el JWT en memoria y el usuario minimo en estado/localStorage.
4. En bootstrap o expiracion, `/api/auth/refresh` rota refresh y devuelve JWT.
5. Logout revoca refresh y limpia cache de React Query.

### Torneo

1. Un torneo nace desde seed, cron o creacion de usuario.
2. `BracketService` crea rondas y enfrentamientos.
3. Los votos de enfrentamientos cierran matches.
4. La propagacion asigna ganadores a rondas siguientes.
5. El detalle de torneo pinta bracket, participantes, estado y duelos abiertos.
6. WebSocket puede empujar actualizaciones del bracket a clientes conectados.

### Juegos diarios

1. Cada juego toma catalogo local/remoto y estado diario del navegador.
2. La UI mantiene progreso, intentos y streak sin bloquear rutas principales.
3. Los resultados se presentan como momentos compartibles y devuelven CTA a
   votar, ranking o juegos relacionados.

### Imagenes de personaje

1. La pagina pide `PersonajeImg` con slug, nombre y opcionalmente URL directa.
2. El componente resuelve asset real, variant o fallback.
3. Si una imagen falla, el fallback conserva layout y evita salto visual.
4. Las galerias auxiliares nunca deben ser requisito para que una ficha se vea
   completa; la card principal y retratos curados tienen prioridad.

## 6. Deploy

### Frontend

Comando principal:

```bash
cd frontend
npm run build:no-images
```

Salida: `frontend/dist`.

El build genera sitemap, service worker, manifest y critical CSS. `_redirects`
controla fallback SPA y redirects canonicos. `_headers` aplica politicas de
seguridad y cache.

### Backend

Railway ejecuta Spring Boot con variables de entorno obligatorias para base de
datos, JWT, TOTP, OAuth, email y flags de produccion. `ProductionSecretsValidator`
bloquea placeholders peligrosos fuera de test.

Healthcheck publico:

```text
https://api.animeshowdown.dev/actuator/health
```

### Base de datos

Supabase aloja PostgreSQL. Flyway aplica migraciones al arranque. Los backups y
rotaciones se documentan en scripts y runbooks.

### Assets

El sync de imagenes se ejecuta fuera del build normal:

```bash
cd frontend
npm run assets:cdn:plan
npm run assets:cdn:sync
```

El primer comando calcula plan; el segundo requiere credenciales R2 y sube
imagenes de forma controlada.

## 7. Calidad y verificacion

Frontend:

```bash
cd frontend
npm run lint
npm run build:no-images
npm run test:e2e:responsive
```

Backend:

```bash
cd backend
./mvnw -q test
```

Checks complementarios:

- `node scripts/sync-personajes.mjs --check`
- `node scripts/qa/catalog-quality.mjs`
- `node scripts/qa/contrast-check.mjs`
- `bash scripts/smoke-test.sh`

## 8. Riesgos conocidos

- SPA sin SSR: crawlers ven HTML inicial para algunas rutas hasta que React
  hidrata metadatos.
- Catalogo grande: grids y assets deben seguir usando lazy loading, pagination,
  variants y fallbacks.
- Imagenes externas: todo slot nuevo necesita archivo real o fallback explicito.
- Auth: cualquier cambio en refresh, SameSite, JWT o OAuth debe probar login,
  callback, refresh, logout y perfil.
- Brackets: cambios en torneo pueden romper propagacion de rondas si no cubren
  matches futuros sin participantes.

## 9. Principios de evolucion

- Mantener rutas publicas navegables aunque fallen partes no criticas.
- Preferir componentes base existentes antes de crear variantes nuevas.
- No introducir servicios externos nuevos sin coste y decision explicita.
- No duplicar reglas de negocio entre frontend y backend si el backend puede
  ser la fuente de verdad.
- Preservar performance visual: menos flashes, menos layout shift, menos carga
  eagerly por debajo del fold.
- Documentar decisiones operativas en `docs/` y mantener README centrado en
  presentacion publica.
