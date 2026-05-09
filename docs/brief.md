# AnimeShowdown — Brief de seguimiento

> Documento de seguimiento del proyecto AnimeShowdown.
> **Última actualización:** 9 mayo 2026.
> **Autor:** Diego Alegil — DAM 1.º.

---

## 1. Resumen ejecutivo

**AnimeShowdown** es una aplicación web full-stack que organiza torneos y rankings de popularidad de personajes de anime. Los usuarios votan en enfrentamientos cara a cara, y un sistema ELO + ranking determina el ganador del torneo y la popularidad acumulada de cada personaje.

**Estado actual:** backend 100% completo y desplegado en producción (`v1.0.0` etiquetada en Git). Frontend recién iniciado, en fase de aprendizaje y construcción.

**Objetivo final:** app premium con landing animada (cartas de personajes moviéndose alrededor), sistema completo de torneos, autenticación real, ranking ELO en vivo y diseño profesional listo para portfolio. Entrega prevista: **septiembre-octubre 2026**.

**Por qué este proyecto:** portfolio para presentar a reclutadores junior+. La idea es que demuestre dominio de Java/Spring Boot, persistencia, seguridad JWT, integración con APIs externas, despliegue en producción y frontend moderno con React.

---

## 2. Stack técnico

### Backend (terminado)

- **Java 21** + **Spring Boot 3.5.14**
  - Web (REST controllers)
  - Data JPA + Hibernate (persistencia)
  - Security + JWT (autenticación)
  - Validation (Bean Validation con `@Valid`)
  - Actuator (healthcheck)
- **PostgreSQL 17** (Neon Free en producción, local en desarrollo)
- **Auth0 java-jwt 4.4.0** + **BCrypt** (hashing de passwords)
- **springdoc-openapi 2.8.5** (Swagger UI)
- **JUnit 5 + MockMvc + H2 in-memory** (tests automatizados)
- **Maven Wrapper** + **Docker multi-stage** (build y deploy)
- **Hosting:** Railway (plan Hobby, sin sleep) + Neon Postgres Free

### Frontend (en construcción — Fase 8)

- **React 19+** (componentes funcionales)
- **Vite 8** (bundler, dev server, HMR)
- **JavaScript** (no TypeScript en v1; lo añadiré en v2)
- **React Router** (navegación entre páginas) — pendiente
- **Tailwind CSS** (estilos utilitarios) — pendiente
- **shadcn/ui** (componentes base premium) — pendiente
- **Framer Motion** (animaciones) — pendiente
- **Fetch API** (consumo del backend) — pendiente
- **React Hook Form** (formularios profesionales) — pendiente
- **Hosting:** Vercel (gratis, deploys automáticos desde GitHub) — pendiente

### Integración externa

- **Jikan API v4** (no oficial de MyAnimeList) — para importar personajes con datos reales (nombre, descripción, imagen, anime de origen).

### Tooling

- **Git + GitHub** (repo único monorepo, `backend/` + `frontend/`)
- **nvm** (gestor de versiones de Node, configurado con Node 22 LTS por defecto)
- **Postman** (colección de 17 endpoints exportada y compartible, con auto-guardado de JWT)
- **Docker** (multi-stage build para deploy ligero)

---

## 3. Estado actual (9 mayo 2026)

### Backend — `v1.0.0` desplegado

- API REST con 17 endpoints (auth, personajes, torneos, votación, ranking, admin).
- Autenticación JWT (HMAC256) con BCrypt para passwords.
- Filtros de seguridad: `JwtAuthFilter`, `SecurityConfig` STATELESS, `@PreAuthorize` con roles `USER`/`ADMIN`.
- 5 entidades JPA con relaciones: `Usuario`, `Personaje`, `Torneo`, `Enfrentamiento`, `Voto` (con UNIQUE constraint para evitar dobles votos).
- Lógica completa de torneos: iniciar, crear bracket en lote, votar, finalizar con cálculo de ganadores por COUNT, NULL en empates.
- Sistema ELO + ranking de popularidad.
- Integración con Jikan API: importación masiva de personajes con datos y avatar reales.
- Validation global con `@Valid` y `@RestControllerAdvice` para errores con detalle por campo.
- CORS configurado (Vercel + localhost para desarrollo).
- Logging estructurado con SLF4J.
- 7 tests JUnit + MockMvc + H2 in-memory pasando en verde.
- README profesional con badges, diagramas Mermaid (modelo de datos + secuencia de auth), instrucciones reproducibles, tabla de variables de entorno.
- Postman Collection v2.1 exportada con 17 endpoints + auto-guardado de JWT en login.

#### URLs en producción

- **API base:** `https://animeshowdown-production-a9f4.up.railway.app`
- **Healthcheck:** `https://animeshowdown-production-a9f4.up.railway.app/actuator/health`
- **Swagger UI:** `https://animeshowdown-production-a9f4.up.railway.app/swagger-ui/index.html`

#### Métricas técnicas

- Tiempo de arranque del backend en Railway Hobby: **10.3 s**.
- Imágenes optimizadas: 96 personajes en WebP-q95, **49 MB** total (vs 246 MB en PNG original).

### Frontend — sesión 1 cerrada

- Proyecto Vite + React inicializado en `frontend/`.
- Node 22 LTS configurado vía nvm.
- HMR funcionando en `localhost:5173`.
- Conceptos asimilados: componentes funcionales, JSX, destructuring, hooks (`useState`).
- Commit y push limpios al monorepo.

---

## 4. Recorrido hasta hoy (fases del proyecto)

| Fase | Descripción | Estado |
|---|---|---|
| **1** | Setup Maven + Spring Boot + PostgreSQL + primer endpoint | Completada |
| **2** | Entidades JPA: `Personaje`, `Torneo`, `Enfrentamiento`, `Voto`, `Usuario` | Completada |
| **3** | CRUD completo con Spring Data JPA | Completada |
| **4** | Brackets de torneos + sistema de votación | Completada |
| **5** | Sistema ELO + rankings | Completada |
| **6** | Spring Security + JWT (registro, login, roles) | Completada |
| **7** | Integración con Jikan API (importar personajes reales) | Completada |
| **8** | Frontend con React + Tailwind + Framer Motion | En curso |

---

## 5. Plan de aquí al final (Fase 8 — Frontend)

La Fase 8 se subdivide en **6 sub-fases**, organizadas para introducir un concepto a la vez y consolidarlo antes de avanzar.

### Sub-fase 8A — Fundamentos React + JS moderno (3-4 semanas)

> **Objetivo:** dominar la sintaxis, los componentes y los hooks básicos. Reforzar JavaScript moderno (ES6+) según vaya apareciendo.

| Sesión | Contenido | Estado |
|---|---|---|
| 1 | Setup nvm + Node 22 LTS + Vite + React + primer "Hello World" | Hecha |
| 2 | Demoler boilerplate de Vite. Crear primer componente propio (`<Header />`). Anidación de componentes | Pendiente |
| 3 | JS moderno parte 1: arrow functions, métodos de array (`.map`, `.filter`, `.reduce`) | Pendiente |
| 4 | JS moderno parte 2: spread/rest operator, async/await, módulos ES (`import`/`export`) | Pendiente |
| 5 | Props (paso de datos entre componentes). Composición | Pendiente |
| 6 | `useState` avanzado. Renderizado de listas con `.map`. Concepto de keys | Pendiente |
| 7 | `useEffect` (efectos secundarios). Primer fetch a una API pública de prueba | Pendiente |

### Sub-fase 8B — Conexión real con el backend (2-3 semanas)

> **Objetivo:** que el frontend deje de hablar con APIs de pega y consuma la API de AnimeShowdown ya desplegada.

| Sesión | Contenido | Estado |
|---|---|---|
| 8 | React Router (navegación entre páginas SPA) | Pendiente |
| 9 | Context API (estado global: usuario logueado, token JWT) | Pendiente |
| 10 | Login + Registro reales contra el backend. Persistencia del JWT en `localStorage` | Pendiente |
| 11 | Wrapper de fetch que añade el header `Authorization: Bearer <jwt>` automáticamente. Manejo de 401/403 | Pendiente |

### Sub-fase 8C — Páginas funcionales (3-4 semanas)

> **Objetivo:** cada endpoint del backend tiene su pantalla en el frontend. App funcional aunque sin diseño premium todavía.

| Sesión | Contenido | Estado |
|---|---|---|
| 12 | Galería de personajes (consume `GET /api/personajes`) | Pendiente |
| 13 | Detalle de personaje (consume `GET /api/personajes/{id}`) | Pendiente |
| 14 | Lista de torneos + detalle de torneo | Pendiente |
| 15 | Bracket visual del torneo (representación gráfica) | Pendiente |
| 16 | Pantalla de votación de enfrentamiento | Pendiente |
| 17 | Ranking global por ELO | Pendiente |
| 18 | Panel admin (CRUD personajes y torneos, restringido a `ROLE_ADMIN`) | Pendiente |

### Sub-fase 8D — Diseño premium (2-3 semanas)

> **Objetivo:** refactorizar la app funcional con un sistema de diseño profesional.

| Sesión | Contenido | Estado |
|---|---|---|
| 19 | Instalar Tailwind CSS. Refactor de la galería con utilidades | Pendiente |
| 20 | Instalar shadcn/ui. Sustituir botones, inputs y modales por componentes premium | Pendiente |
| 21 | Sistema de diseño: paleta, tipografía, modo oscuro nativo | Pendiente |
| 22 | Responsive design (móvil, tablet, desktop) | Pendiente |

### Sub-fase 8E — Animaciones premium (1-2 semanas)

> **Objetivo:** el "wow factor" que diferencia un junior medio de un junior con criterio estético.

| Sesión | Contenido | Estado |
|---|---|---|
| 23 | Instalar Framer Motion. Animaciones básicas (entrada, salida, hover) | Pendiente |
| 24 | **Landing con cartas de personajes moviéndose alrededor** (la pantalla "vendedora" de la app) | Pendiente |
| 25 | Transiciones entre páginas | Pendiente |
| 26 | Microinteracciones (votación, hover sobre cards, feedback al ganar) | Pendiente |

### Sub-fase 8F — Deploy + pulido final (1 semana)

> **Objetivo:** que la app sea pública, accesible y enseñable a un reclutador.

| Sesión | Contenido | Estado |
|---|---|---|
| 27 | Variables de entorno del frontend (URL del backend, etc.) | Pendiente |
| 28 | Deploy en Vercel. Conexión automática con GitHub | Pendiente |
| 29 | CI/CD con GitHub Actions (tests + build automático en cada PR) | Pendiente |
| 30 | README final del proyecto + portfolio prep + screenshots de la app en producción | Pendiente |

### Estimación total de Fase 8

- **Sesiones:** ~30
- **Tiempo aproximado:** 13-17 semanas (a 2 sesiones por semana)
- **Fecha estimada de release v2.0.0:** septiembre-octubre 2026

---

## 6. Resultado final esperado

Cuando AnimeShowdown esté terminado, será:

### Funcional

- Web app SPA en `https://animeshowdown.vercel.app` (o dominio propio).
- Backend REST en `https://animeshowdown-production-a9f4.up.railway.app` (ya en producción).
- Login + Registro reales con JWT.
- Galería pública con 96+ personajes importados de MyAnimeList vía Jikan.
- Sistema de torneos: crear, iniciar, votar, finalizar.
- Ranking ELO global y por torneo.
- Panel admin para gestionar el catálogo.
- Modo oscuro nativo.
- Responsive en móvil, tablet y desktop.

### Visualmente premium

- **Landing animada:** cartas de personajes moviéndose alrededor del título y CTA.
- Tipografía y paleta consistentes con un sistema de diseño.
- Microinteracciones en cada acción (votar, hover, feedback de ganador).
- Transiciones de página fluidas.

### Profesionalmente

- Documentación completa: README de monorepo, README de backend, README de frontend, Postman collection, Swagger UI.
- Tests automatizados (backend pasa; frontend con Vitest pendiente de roadmap).
- CI/CD con GitHub Actions: tests + build en cada PR.
- Deploys automáticos al hacer merge a `main`.
- Healthchecks y logs estructurados.
- Preparada para enseñar a reclutadores junior+ como portfolio.

### Diferenciadores frente a un proyecto junior medio

- **Backend desplegado en producción real, no en localhost.**
- **Frontend con animaciones que no son CSS-básico**, sino con biblioteca pro (Framer Motion).
- **Iteración v1 → v2 visible en commits**: demuestra evolución profesional, no "la versión final salió mágicamente".
- **Documentación que un reclutador puede leer en 5 minutos** y entender qué hace la app y cómo está construida.

---

## 7. Qué me gustaría pedirte, profe

He pensado las áreas donde tu criterio me sería más útil:

1. **Revisión de la arquitectura del frontend** antes de empezar las sub-fases C y D. ¿Qué estructura de carpetas recomendarías? ¿Algún patrón concreto (feature-based vs type-based)?

2. **Recomendaciones sobre tests del frontend**: ¿Vitest + React Testing Library es la combinación que ves más útil aprender en mi nivel actual?

3. **Validación del orden propuesto**: ¿la sub-fase D (Diseño premium con Tailwind/shadcn) llega demasiado tarde? ¿Habría que mezclarla con la sub-fase C, o de hecho está bien hacerla al final?

4. **Pull Request reviews**: si tienes tiempo y te apetece, los PRs de cada sub-fase los puedo abrir contra una rama `develop` y pedirte review antes de mergear a `main`.

5. **Defensa final**: cuando la v2.0.0 esté lista (septiembre-octubre), me gustaría una presentación del proyecto contigo de 30-40 min: arquitectura, decisiones, problemas encontrados, soluciones. Como simulación de defensa de TFG (aunque no lo sea formalmente).

---

## 8. Recursos del proyecto

- **Repositorio GitHub:** `https://github.com/diegoalegil/AnimeShowdown`
- **Backend en producción:** `https://animeshowdown-production-a9f4.up.railway.app`
- **Healthcheck:** `https://animeshowdown-production-a9f4.up.railway.app/actuator/health`
- **Swagger UI:** `https://animeshowdown-production-a9f4.up.railway.app/swagger-ui/index.html`
- **Frontend (en localhost por ahora):** `http://localhost:5173`
- **Postman Collection:** incluida en `docs/postman/` del repo
- **Diagramas y screenshots:** incluidos en `README.md` y `docs/screenshots/`

---

**Diego Alegil**
DAM 1.º — Proyecto AnimeShowdown
9 mayo 2026
