# AnimeShowdown

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-v4-38BDF8?logo=tailwindcss&logoColor=white)
![Framer Motion](https://img.shields.io/badge/Framer%20Motion-12-FF0080?logo=framer&logoColor=white)
![Java](https://img.shields.io/badge/Java-21-007396?logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.5.14-6DB33F?logo=springboot&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791?logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

**El ranking definitivo del anime lo decides tú.**

AnimeShowdown es una app full-stack de duelos 1v1, ranking ELO, torneos visuales y minijuegos diarios sobre personajes de anime. El frontend busca una experiencia competitiva y cinemática: cards visuales, podio, bracket, buscadores rápidos, command palette, sonidos sintetizados y una PWA preparada para producción.

El catálogo actual contiene **1052 personajes únicos** en **105 animes**, sincronizados desde imágenes locales hacia frontend y backend.

## Live

| Pieza | URL |
|---|---|
| Frontend | https://animeshowdown.dev |
| API | https://api.animeshowdown.dev |
| Swagger UI | https://api.animeshowdown.dev/swagger-ui/index.html |
| Healthcheck | https://api.animeshowdown.dev/actuator/health |

## Capturas

| Home | Votar |
|---|---|
| ![Home de AnimeShowdown](docs/screenshots/hero.webp) | ![Arena de votación 1v1](docs/screenshots/votar.webp) |

| Ranking | Personajes |
|---|---|
| ![Podio y ranking ELO](docs/screenshots/top10.webp) | ![Catálogo de personajes](docs/screenshots/personajes.webp) |

| Universo anime | Juegos diarios |
|---|---|
| ![Detalle de universo anime](docs/screenshots/animes.webp) | ![Hub de Anime Daily Trials](docs/screenshots/games.webp) |

| Torneo | Ficha de personaje |
|---|---|
| ![Detalle de torneo con bracket](docs/screenshots/bracket.webp) | ![Detalle de personaje](docs/screenshots/personaje-detail.webp) |

| API |
|---|
| ![Swagger UI de AnimeShowdown](docs/screenshots/swagger-overview.webp) |

## Qué incluye

- Duelos 1v1 con ranking ELO, feedback visual y modo rápido.
- Ranking global con podio, filtros, búsqueda, histórico y vistas por anime.
- Catálogo de 1052 personajes con búsqueda, filtros, grid/list y fichas individuales.
- Páginas de anime con collage, estadísticas agregadas, ranking interno y CTA de voto.
- Torneos con detalle visual, bracket SVG, estados, participantes y votación desde enfrentamientos abiertos.
- Anime Daily Trials: Shadow Guess, Anime Reveal, AniGrid, Impostor Trial y ELO Duel.
- Auth con JWT, refresh cookie, 2FA TOTP, OAuth Google/Discord, reset por email y perfil público.
- Logros, reacciones, follow, actividad reciente, newsletter y página de apoyo.
- Command palette `Cmd+K`, notificaciones, sonidos Web Audio API y PWA con Workbox.
- SEO técnico: sitemap, image sitemap, robots, canonical, Open Graph, JSON-LD y páginas públicas indexables.

## Stack

### Frontend

| Área | Tecnología |
|---|---|
| UI | React 19, React Router 7, Tailwind CSS v4, Framer Motion 12 |
| Forms | react-hook-form 7 |
| Datos | TanStack Query, helpers locales de catálogo, cache de browser |
| Interacción | cmdk, Sonner, Lucide React, Web Audio API |
| Build | Vite 8 con `@tailwindcss/vite`, PWA Workbox, critical CSS inline |
| Observabilidad | Sentry + Web Vitals |

### Backend

| Área | Tecnología |
|---|---|
| Runtime | Java 21, Spring Boot 3.5.14 |
| API | Spring Web, Spring Security, Spring Validation, springdoc-openapi |
| Datos | PostgreSQL 17, Spring Data JPA, Flyway |
| Auth | JWT, refresh tokens httpOnly, TOTP cifrado, OAuth2 |
| Tiempo real | WebSocket STOMP |
| Resiliencia | Caffeine, Resilience4j, Actuator |
| Tests | JUnit 5, MockMvc, H2 |

## Arquitectura

```text
AnimeShowdown/
├── frontend/              # React + Vite + Tailwind + PWA
│   ├── img/               # Fuente visual del catálogo
│   ├── public/            # PWA, redirects, robots, sitemap, llms.txt
│   └── src/               # App, rutas, componentes, hooks y helpers
├── backend/               # Spring Boot API
│   └── src/main/resources # Flyway, config y personajes-seed.json
├── scripts/               # Sync de catálogo, sitemap, smoke tests
└── docs/                  # Runbooks, Postman y capturas públicas
```

### Flujo de catálogo

`frontend/img/` es la fuente visual del catálogo. Cada personaje vive en:

```text
frontend/img/<Nombre_del_Anime>/<slug>.webp
```

El script de sincronización valida slugs, colisiones, nombres visibles y genera el seed backend:

```bash
node scripts/sync-personajes.mjs --check
node scripts/sync-personajes.mjs --dry-run
```

Las variantes responsive (`300`, `600`, `1024`, AVIF/WebP) ya están versionadas. En deploy se usa `build:no-images` para no regenerarlas en Cloudflare.

## Setup local

### Requisitos

- Node 22 LTS
- Java 21
- PostgreSQL 17
- Maven Wrapper incluido en `backend/`

### Backend

```bash
cd backend
cp .env.example .env
./mvnw spring-boot:run
```

Por defecto Spring levanta en `http://localhost:8080`. Ajusta `DATABASE_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET` y `TOTP_ENCRYPTION_KEY` en tu `.env`.

### Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Vite levanta en `http://localhost:5173`. Para usar backend local:

```env
VITE_API_URL=http://localhost:8080
```

## Scripts útiles

### Frontend

```bash
cd frontend
npm run lint
npm run build:no-images
npm run test:bundle
```

### Backend

```bash
cd backend
./mvnw test
```

### Smoke de producción

```bash
bash scripts/smoke-test.sh
```

El smoke valida healthcheck, catálogo, filtro por anime, ranking público, Swagger, frontend, SPA routing y login inválido con `401`.

## Deploy

| Servicio | Uso |
|---|---|
| Cloudflare Pages | Frontend y dominio principal |
| Railway | Backend Spring Boot |
| Neon | PostgreSQL |
| Cloudflare Registrar | Dominio `.dev` |

Notas clave:

- Frontend build command: `npm run build:no-images`.
- Output frontend: `frontend/dist`.
- API pública: `https://api.animeshowdown.dev`.
- SPA fallback y redirects viven en `frontend/public/_redirects`.
- Workbox cachea recursos estaticos y rutas API seleccionadas con estrategias diferenciadas.
- `ProductionSecretsValidator` bloquea placeholders peligrosos fuera de test.

## API

La documentación interactiva está en:

```text
https://api.animeshowdown.dev/swagger-ui/index.html
```

Endpoints públicos destacados:

- `GET /api/personajes`
- `GET /api/votos/ranking`
- `GET /api/torneos`
- `GET /api/torneos/{slug}`
- `GET /actuator/health`

La API completa incluye auth, perfil, logros, reacciones, follow, torneos, votos, predicciones, newsletter, observabilidad y WebSocket.

## Calidad y estado

Validaciones recomendadas antes de publicar cambios:

```bash
cd frontend && npm run lint && npm run build:no-images && npm run test:bundle
cd backend && ./mvnw test
bash scripts/smoke-test.sh
```

Estado actual del catálogo:

- 1052 personajes sincronizados.
- 105 universos anime.
- Sitemap con rutas estáticas, personajes, animes, torneos y duelos SEO.
- Fallback visual para imágenes de personaje y placeholders de carga/error.

## Documentacion adicional

- [Runbook general](RUNBOOK.md)
- [Deploy Railway](docs/runbooks/railway-deploy.md)
- [Sentry releases](docs/runbooks/sentry-release.md)
- [Seguridad](docs/SECURITY.md)
- [Postman](docs/postman/README.md)

## Licencia y disclaimer

Este proyecto usa licencia MIT. AnimeShowdown es un proyecto fan-made y no esta afiliado a estudios, editoriales ni propietarios de las franquicias mencionadas. Los nombres, personajes y referencias pertenecen a sus respectivos titulares.
