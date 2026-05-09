# AnimeShowdown

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white)
![Framer Motion](https://img.shields.io/badge/Framer%20Motion-12-FF0080?logo=framer&logoColor=white)
![Java](https://img.shields.io/badge/Java-21-007396?logo=java&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.5.14-6DB33F?logo=springboot&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791?logo=postgresql&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-Auth0%20java--jwt-000000?logo=jsonwebtokens&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

App full-stack de torneos y rankings ELO de personajes anime. Frontend React premium con aurora hero, carruseles tipo Crunchyroll, búsqueda + filtros, command palette tipo Linear, sonidos anime sintetizados con Web Audio API, bracket visual y auth real con JWT. Backend Spring Boot + PostgreSQL en Railway/Neon, frontend en Cloudflare Pages.

> **Estado:** ✅ Backend desplegado · ✅ Frontend desplegado · ✅ BBDD seedeada con 96 personajes

---

## Live

| Pieza | URL |
|---|---|
| **🌐 Frontend** | https://animeshowdown.pages.dev |
| **🔌 API** | https://animeshowdown-production-a9f4.up.railway.app |
| **📚 Swagger UI** | https://animeshowdown-production-a9f4.up.railway.app/swagger-ui/index.html |
| **❤️ Health** | https://animeshowdown-production-a9f4.up.railway.app/actuator/health |

> Hosting: **Cloudflare Pages** (frontend, free tier) + **Railway Hobby** (backend, sin sleep) + **Neon Free** (Postgres en Frankfurt).

---

## Stack

### Frontend (`frontend/`)

- **React 19** + **Vite 8** (HMR + Rolldown bundler)
- **Tailwind CSS v4** vía `@tailwindcss/vite` con tokens nativos en `@theme` (paleta dark anime: `#0d0d12` bg + `#ff2e63` accent magenta)
- **Framer Motion 12** para animaciones, parallax mouse-tracked, AnimatePresence en transiciones de ruta
- **React Router 7** (BrowserRouter + 11 rutas + URL search params para filtros)
- **react-hook-form 7** para validación de formularios (Login + Register)
- **Lucide React** + SVG inline para iconografía
- **Sonner** para toast notifications
- **cmdk** (Vercel) para command palette `Cmd+K`
- **Web Audio API** sintetiza sonidos anime sin assets (5 efectos: click/hover/vote/whoosh/magic/impact/level-up)
- **Geist** + **Geist Mono** vía Google Fonts

### Backend (`backend/`)

- **Java 21** + **Spring Boot 3.5.14** (Web + Data JPA + Security + Validation + Actuator)
- **PostgreSQL 17** (Neon en producción, local en dev)
- **JWT** con `com.auth0:java-jwt 4.4.0` y BCrypt para hashing
- **springdoc-openapi 2.8.5** (Swagger UI)
- **DataSeeder** que popula los 96 personajes en arranque si la BBDD está vacía
- **JUnit 5** + **MockMvc** + **H2** in-memory para tests
- **Maven Wrapper** + **Docker** multi-stage para deploy

### Tooling

- **Git** monorepo (`backend/` + `frontend/`)
- **GitHub** con auto-deploy a Cloudflare Pages (main → producción)
- **Postman** colección con 17 endpoints (`docs/postman/`)

---

## Capturas

> Capturas frescas tras el deploy. Más en `docs/screenshots/`.

**Hero animado con aurora multilayer + 8 cards flotantes con parallax**

![Hero landing](docs/screenshots/hero.webp)

**Galería de los 96 personajes con búsqueda, filtros por anime y view toggle**

![Galería personajes](docs/screenshots/personajes.webp)

**Detalle de torneo con bracket visual SVG**

![Bracket torneo](docs/screenshots/bracket.webp)

**Detalle de personaje con stats ELO + récord + sección "Más de \[anime\]"**

![Detalle personaje](docs/screenshots/personaje-detail.webp)

**Pantalla de votación 1v1 con badge VS y reveal de porcentajes**

![Pantalla de votar](docs/screenshots/votar.webp)

**Top 10 ELO con números gigantes outline magenta (Crunchyroll style)**

![Top 10 ranking](docs/screenshots/top10.webp)

**Swagger UI del backend (13 paths)**

![Swagger UI overview](docs/screenshots/swagger-overview.webp)

---

## Features destacadas del frontend

- 🎨 **Aurora multilayer** en Hero: 3 blobs animados (magenta + purple + cyan) con CSS keyframes desfasados
- 🎴 **8 cards flotantes** alrededor del logo con parallax mouse-tracked (3 niveles de profundidad)
- 🌀 **3D tilt + spotlight** en cada card del catálogo (mouse-tracked + spring smoothing)
- 🎠 **Carruseles horizontales por anime** estilo Netflix/Crunchyroll (snap-x scroll-smooth)
- 🏆 **Top 10 ELO** con números gigantes outline magenta solapando las cards (Crunchyroll vibe)
- ⚔️ **Live Battle widget** auto-cyclando matchups cada 5s con AnimatePresence
- 📜 **Marquee infinita** con los 96 nombres y fade en bordes
- 🔢 **Stats counter rolling** (96 / 7 / 32 / max ELO) con easeOutCubic en viewport
- 🎁 **Bento grid** asimétrico con 4 features (Brackets, ELO, Cuenta, Comunidad)
- 🌳 **Bracket SVG** que computa rounds y resuelve por mayor ELO, ganador con border accent y glow
- ⌘ **Command palette** (`Cmd+K`) con cmdk: navega a páginas, personajes y torneos con búsqueda fuzzy
- 🔍 **Búsqueda + filtros + sort + grid/list toggle** en `/personajes` (estilo MyAnimeList)
- 🌐 **Filter persistente vía URL** (`/personajes?anime=Naruto`)
- 🎭 **404 con personaje random** y número outline magenta detrás
- 🎵 **Sonidos anime sintetizados** vía Web Audio API: click, vote (acorde mayor + sparkle), whoosh, magic, impact, level-up. Toggle de mute en Header
- 🍞 **Toast notifications** (Sonner) en login/logout/voto
- 📊 **Progress bar** del scroll arriba con glow magenta
- 🪟 **Sticky Header frosted-glass** con backdrop-blur al scroll
- 🌑 **Texto shimmer animado** en H1 del Hero
- 🎯 **CTA pulse halo** en botón primario del Hero
- 📱 **Responsive** con prefers-reduced-motion respetado
- 🔐 **Auth real con JWT** (con fallback a modo demo si el backend no responde)

---

## Setup local

### Backend

```bash
# Requisitos: Java 21, PostgreSQL 17 en localhost:5432
psql -U postgres -c "CREATE DATABASE animeshowdown_db;"
psql -U postgres -c "CREATE USER animeshowdown_user WITH PASSWORD 'animeshowdown_dev_2026';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE animeshowdown_db TO animeshowdown_user;"

cd backend
./mvnw spring-boot:run
# Spring levanta en http://localhost:8080
# DataSeeder pobla los 96 personajes en el primer arranque
```

### Frontend

```bash
# Requisitos: Node 22 LTS (vía nvm)
cd frontend
nvm use 22  # o nvm install 22 si no lo tienes
npm install
npm run dev
# Vite levanta en http://localhost:5173
```

Por defecto el frontend apunta al backend de Railway. Si quieres apuntarlo a tu backend local, crea `frontend/.env.local`:

```
VITE_API_URL=http://localhost:8080
```

### Tests

```bash
# Backend (JUnit + MockMvc + H2)
cd backend && ./mvnw test
```

---

## Variables de entorno

### Backend (`backend/.env`)

| Variable | Default (dev) | Notas |
|---|---|---|
| `DATABASE_URL` | `jdbc:postgresql://localhost:5432/animeshowdown_db` | URL JDBC completa |
| `DB_USER` | `animeshowdown_user` | |
| `DB_PASSWORD` | `animeshowdown_dev_2026` | **regenerar en producción** |
| `JWT_SECRET` | clave dev hardcodeada | **generar con `openssl rand -base64 64` para prod** |
| `JWT_EXPIRATION` | `3600000` | ms (1 h) |
| `JPA_DDL` | `update` | `validate` o `none` en prod |
| `SHOW_SQL` | `true` | `false` en prod |
| `PORT` | `8080` | Railway lo inyecta |

### Frontend (`frontend/.env.local`)

| Variable | Default | Notas |
|---|---|---|
| `VITE_API_URL` | URL pública de Railway | Apunta a tu backend local en dev si lo prefieres |

---

## Modelo de datos

```mermaid
erDiagram
    USUARIOS ||--o{ VOTOS : "emite"
    PERSONAJES ||--o{ VOTOS : "recibe"
    ENFRENTAMIENTOS ||--o{ VOTOS : "se vota en"
    TORNEOS ||--o{ ENFRENTAMIENTOS : "contiene"
    PERSONAJES ||--o{ ENFRENTAMIENTOS : "personaje1"
    PERSONAJES ||--o{ ENFRENTAMIENTOS : "personaje2"
    PERSONAJES ||--o{ ENFRENTAMIENTOS : "ganador"

    USUARIOS {
        bigint id PK
        string username UK
        string password "BCrypt"
        string email UK
        enum rol "USER, ADMIN"
        timestamp fecha_registro
    }
    PERSONAJES {
        bigint id PK
        string slug UK "para url + frontend img"
        string nombre
        string anime
        string descripcion
        string imagen_url
    }
    VOTOS {
        bigint id PK
        timestamp fecha
        bigint personaje_id FK
        bigint usuario_id FK "nullable"
        bigint enfrentamiento_id FK "nullable"
    }
    TORNEOS {
        bigint id PK
        string nombre
        string descripcion
        enum estado "BORRADOR, ACTIVO, FINALIZADO"
        timestamp fecha_creacion
        timestamp fecha_inicio
        timestamp fecha_finalizacion
    }
    ENFRENTAMIENTOS {
        bigint id PK
        bigint torneo_id FK
        bigint personaje1_id FK
        bigint personaje2_id FK
        bigint ganador_id FK "nullable"
        timestamp fecha_creacion
    }
```

**Constraints clave:**
- `UNIQUE (slug)` en `personajes` → cada personaje tiene un slug único que casa 1:1 con su WebP en el frontend
- `UNIQUE (personaje_id, usuario_id)` en `votos` → 1 voto por usuario por personaje
- `UNIQUE (enfrentamiento_id, usuario_id)` en `votos` → 1 voto por usuario por enfrentamiento

---

## Endpoints

### Públicos

| Método | Path | Qué hace |
|---|---|---|
| POST | `/api/auth/registro` | Crea usuario nuevo (BCrypt). 409 si username duplicado. |
| POST | `/api/auth/login` | Devuelve `{token: "..."}`. 401 en credenciales inválidas. |
| GET | `/api/personajes` | Lista todos. `?anime=Naruto` filtra. |
| GET | `/api/personajes/{id}` | Por id. 404 si no existe. |
| GET | `/api/votos/ranking` | Ranking agregado por COUNT (JPQL). |
| GET | `/api/torneos` | Lista todos los torneos. |
| GET | `/actuator/health` | Healthcheck. |
| GET | `/swagger-ui/index.html` | Swagger UI. |

### Protegidos (JWT)

| Método | Path | Qué hace |
|---|---|---|
| POST | `/api/personajes/{id}/votar` | Voto general. 409 si ya votó. |
| POST | `/api/enfrentamientos/{id}/votar` | Body `{personajeGanadorId}`. |

### ADMIN

| Método | Path | Qué hace |
|---|---|---|
| POST/PUT/DELETE | `/api/personajes/**` | CRUD completo. |
| POST/PUT/DELETE | `/api/torneos/**` | CRUD + iniciar/finalizar. |
| POST | `/api/admin/personajes/importar?cantidad=N` | Importa top N desde Jikan. |

---

## Despliegue

### Frontend en Cloudflare Pages

1. Cuenta en https://dash.cloudflare.com
2. Workers & Pages → Create → **Connect to Git** → autoriza GitHub
3. Selecciona `AnimeShowdown` → configura:
   - **Project name:** `animeshowdown`
   - **Production branch:** `main`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory** (advanced): `frontend`
4. **Environment variables:** `VITE_API_URL` = URL de tu backend
5. Save and Deploy → ~1-2 min y tienes `https://animeshowdown.pages.dev`
6. **`frontend/public/_redirects`** ya configurado con `/* /index.html 200` para SPA routing

### Backend en Railway

1. Cuenta en https://railway.app
2. New Project → Deploy from GitHub → `AnimeShowdown`
3. Settings → Root Directory: `backend` (Dockerfile auto-detectado)
4. Variables: las 7 de la tabla de arriba
5. Settings → Networking → Generate Domain (puerto 8080)

### Postgres en Neon Free

1. Cuenta en https://neon.tech
2. New Project → Postgres 17 → Frankfurt
3. Construir `DATABASE_URL` con prefijo `jdbc:` y `?sslmode=require`
4. La primera vez que arranque el backend, **DataSeeder** pobla los 96 personajes automáticamente

---

## Mantenimiento

### Añadir un personaje nuevo

1. Coloca el WebP en `frontend/public/personajes/{slug}.webp` (ratio 2:3, recomendado 1024x1536)
2. Añade entrada en `frontend/src/data/personajes.js`:
   ```js
   { slug: 'mi_personaje', nombre: 'Mi Personaje', anime: 'Mi Anime' }
   ```
3. Añade entrada en `backend/src/main/resources/personajes-seed.json` (mismo objeto)
4. `git push` → Cloudflare rebuild en 2 min, frontend muestra el nuevo personaje
5. Para que aparezca también en BBDD: como el `DataSeeder` solo pobla si la tabla está vacía, hay dos opciones:
   - **Opción rápida (recomendada):** llamada manual al endpoint admin con un POST custom (necesita endpoint nuevo)
   - **Opción nuke:** vaciar tabla `personajes` en Neon y reiniciar el backend (re-poblará todos los 96 + el nuevo)

### Añadir un torneo nuevo

1. Edita `frontend/src/data/torneos.js` y añade un objeto:
   ```js
   {
     slug: 'mi-torneo',
     nombre: 'Mi Torneo',
     estado: 'en-curso', // o 'finalizado' o 'proximo'
     fechaInicio: '2026-06-01',
     fechaFin: null,
     participantes: ['naruto', 'luffy', ...], // 8 o 16 slugs
     winner: null,
   }
   ```
2. `git push` → Cloudflare redespliega → torneo aparece en `/torneos` y en el bracket

### Cambiar paleta o tipografía

- Paleta: edita los tokens en `frontend/src/index.css` dentro del bloque `@theme` (`--color-accent`, `--color-bg`, etc.)
- Tipografía: cambia el `<link>` de Google Fonts en `frontend/index.html` y los tokens `--font-sans`/`--font-mono` en `index.css`

### Ver logs

- **Frontend (Cloudflare):** dash.cloudflare.com → Workers & Pages → animeshowdown → Deployments → View build logs
- **Backend (Railway):** dashboard.railway.app → tu proyecto → Deployments → Logs

---

## Roadmap

- [x] Backend Spring Boot + JWT + PostgreSQL
- [x] Despliegue backend en Railway
- [x] Frontend React + Vite + Tailwind v4 + Framer Motion
- [x] Despliegue frontend en Cloudflare Pages
- [x] BBDD seedeada con los 96 personajes
- [x] Auth real con fallback demo
- [x] Bracket visual SVG
- [x] Búsqueda + filtros + view toggle
- [x] Cmd+K command palette
- [x] Sonidos anime sintetizados
- [ ] Endpoint admin para añadir personajes incrementalmente
- [ ] Tests E2E con Playwright
- [ ] Más tests backend (TorneoController, EnfrentamientoController)
- [ ] Dominio custom (`animeshowdown.dev`)
- [ ] PWA + service worker para offline

---

## Disclaimer

Este proyecto utiliza nombres e imágenes de personajes de anime con fines educativos. Todo el contenido pertenece a sus respectivos autores y casas productoras. Distribuido bajo [MIT](LICENSE) para el código fuente.

---

## Autor

Diego Gil — [@diegoalegil](https://github.com/diegoalegil) — diegogildam@gmail.com
