# DEMO_PLAYBOOK.md — guion para presentar AnimeShowdown

Cómo presentar el proyecto en 3 formatos: 2 min flash, 15 min defensa, 30 min profundidad técnica. Más Q&A defensivo.

URLs (memorizar antes de la demo):
- **Frontend:** https://animeshowdown.pages.dev
- **API:** https://animeshowdown-production-a9f4.up.railway.app
- **Swagger:** https://animeshowdown-production-a9f4.up.railway.app/swagger-ui/index.html
- **Health:** https://animeshowdown-production-a9f4.up.railway.app/actuator/health
- **Repo:** https://github.com/diegoalegil/AnimeShowdown

---

## 🚀 Demo de 2 minutos (entrevista flash, profesor pasando)

**Objetivo:** demostrar que existe y se ve serio. Vender la cara visual + 1 hito técnico.

| Tiempo | Acción | Frase a decir |
|---|---|---|
| 0:00 | Abre `https://animeshowdown.pages.dev` en pantalla completa | *"App full-stack de torneos anime — 125 personajes, 7 torneos, ranking ELO."* |
| 0:15 | Espera al hero animado (aurora + 8 cards flotantes con parallax) | *"Frontend en React 19 + Vite + Tailwind 4 + Framer Motion."* |
| 0:30 | Cmd+K → escribe "luffy" → Enter | *"Command palette tipo Linear. Búsqueda en los 125 personajes en tiempo real."* |
| 0:50 | En PersonajeDetailPage: scroll → vista 3D + bio en español + más personajes del anime | *"Detalle con render 3D pseudo-Three.js, bio curada a mano, sección 'Más de One Piece'."* |
| 1:10 | Vuelve y entra a `/torneos/shonen-showdown` | *"Bracket SVG resuelto por mayor ELO."* |
| 1:30 | Click "Ver ranking" → tabla de 125 ordenada | *"Ranking por puntuación ELO derivada del hash del slug."* |
| 1:45 | Pestaña nueva: `https://...railway.app/swagger-ui/index.html` | *"Backend Spring Boot 3.5 + JPA + JWT, Swagger documenta los 17 endpoints."* |
| 2:00 | Cierra. | *"Repo en mi GitHub, deploy en Cloudflare Pages + Railway + Neon."* |

**Tip:** abre las pestañas con antelación. No improvises navegación con audiencia mirando.

---

## 🎓 Demo de 15 minutos (defensa de proyecto DAM)

**Objetivo:** demostrar que entiendes la arquitectura, las decisiones técnicas y la entrega.

### Bloque 1 — Visión general (2 min)

1. *Hero:* "App de votación y ranking de personajes de anime. Stack full-stack pensada para portfolio."
2. Stack del README: React 19 + Spring Boot 3.5 + PostgreSQL 17. Cloudflare Pages + Railway + Neon Free.
3. Repo monorepo: `frontend/` + `backend/` + `docs/` + `scripts/`.

### Bloque 2 — Frontend en vivo (4 min)

1. **Hero animado** (`InicioPage.jsx`): aurora multilayer + 8 cards flotantes parallax mouse-tracked.
2. **Catálogo** (`/personajes`): 125 cards con búsqueda + filtros + sort + URL persistente (`?anime=Naruto`).
3. **Carruseles por anime** estilo Crunchyroll (snap-x scroll-smooth).
4. **Top 10 ELO** con números gigantes outline (Crunchyroll vibe).
5. **Cmd+K command palette** con cmdk (Vercel).
6. **Sonidos sintetizados Web Audio API** (7 efectos).
7. **3D tilt + spotlight** mouse-tracked en cards (Framer Motion `useMotionValue` + `useSpring`).

### Bloque 3 — Backend en vivo (3 min)

1. **Swagger UI** (`/swagger-ui/index.html`): 17 paths, 21 operaciones documentadas.
2. **Auth flow:** registro → login → JWT en localStorage. Protected endpoints exigen Bearer token.
3. **Reset password vía Resend HTTP API** (decisión técnica clave: Railway bloquea SMTP outbound).
4. **DataSeeder idempotente:** lee `personajes-seed.json`, inserta solo slugs faltantes en cada arranque.

### Bloque 4 — Modelo de datos (2 min)

Abre el ER del README (mermaid). Explica:

- `usuarios` con `username UK`, `email UK`, `password BCrypt`, `rol enum USER/ADMIN`.
- `personajes` con `slug UK` (link 1:1 con webp del frontend).
- `votos` con `UNIQUE (personaje_id, usuario_id)` y `UNIQUE (enfrentamiento_id, usuario_id)` — un voto por usuario por target.
- `enfrentamientos` con FK a torneo + 2 personajes + ganador opcional.
- `torneos` con enum `BORRADOR/ACTIVO/FINALIZADO`.

### Bloque 5 — Seguridad (2 min)

- JWT con HS256 + clave 256 bits.
- Spring Security: `JwtAuthFilter` por request, roles validados por endpoint.
- BCrypt para passwords.
- CORS limitado a orígenes conocidos (sin wildcard).
- Headers: CSP + HSTS + X-Frame-Options + Permissions-Policy en Cloudflare Pages (`_headers`).
- Tests cubren: registro/login/voto duplicado/ADMIN-only.

### Bloque 6 — Deploy (2 min)

1. **Frontend en Cloudflare Pages:** build automático con cada push a `main`. SPA routing con `_redirects`. Cache agresivo en assets, no-cache en `/`.
2. **Backend en Railway:** Dockerfile multi-stage Java 21 → JRE alpine. Variables de entorno: `DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY`, `ADMIN_EMAILS`.
3. **BBDD en Neon Free:** Postgres 17 en Frankfurt. SSL forzado.
4. **Email transaccional via Resend** (HTTPS, no SMTP).

---

## 🔬 Demo de 30 minutos (técnica profunda)

### 0–5 min: walkthrough del repo

```bash
git clone https://github.com/diegoalegil/AnimeShowdown
tree -L 2
```

Explica capas: `backend/src/main/java/com/diegoalegil/animeshowdown/{controller,service,repository,model,dto,config,security}` siguiendo Clean Architecture light. Frontend: `src/{pages,components,contexts,hooks,lib,data}`.

### 5–10 min: live coding "añadir un personaje nuevo end-to-end"

1. Coloca webp en `frontend/public/personajes/test.webp`.
2. Añade entrada en `frontend/src/data/personajes.js`.
3. Añade entrada en `backend/src/main/resources/personajes-seed.json`.
4. `git push` → Cloudflare deploya frontend en 2 min, Railway redeploya backend en 1 min.
5. **DataSeeder idempotente** detecta el slug nuevo y lo INSERTA en Neon sin truncar la tabla.
6. Ejecuta `bash scripts/smoke-test.sh` → verifica que ahora hay 126 personajes.

### 10–15 min: tour de Swagger + auth en vivo

1. Abre `/swagger-ui/index.html`.
2. **POST /api/auth/registro** → crea user. Muestra el body con `username/password/email`. 201 Created sin password en respuesta.
3. **POST /api/auth/login** → recibe `{ token: "eyJ..." }`. Pega en jwt.io: muestra payload con `sub`, `rol`, `exp`.
4. Click "Authorize" en Swagger → pega `Bearer eyJ...`.
5. **POST /api/torneos** con USER → 403 Forbidden. Re-registra como `diegogildam@gmail.com` (ADMIN_EMAILS) → ahora 200.
6. **POST /api/torneos/{id}/iniciar** → estado=ACTIVO.
7. **POST /api/enfrentamientos/{id}/votar** → 200, después 409 (voto duplicado bloqueado por UNIQUE constraint).

### 15–20 min: tests pasando

```bash
cd backend && ./mvnw test
```

Mientras corre:
- 21 tests, 3 clases (`AuthControllerTest`, `TorneoControllerTest`, `EnfrentamientoControllerTest`).
- Cada test usa MockMvc + H2 in-memory (perfil `test` con `application-test.properties`).
- Tests obtienen JWT real vía `/api/auth/login` (no @WithMockUser) porque el controller usa `@AuthenticationPrincipal Usuario` (entidad real).

### 20–25 min: GitHub Actions del cron de torneos automáticos

(Si está implementado)

1. Abre `.github/workflows/auto-tournament.yml`.
2. Trigger: `cron: '0 9 */3 * *'` o manual via `workflow_dispatch`.
3. Llama `POST /api/admin/torneos/auto-generar` con `ADMIN_TOKEN` desde GitHub Secrets.
4. Backend selecciona N personajes según estrategia (random, mismo_anime, ELO_similar, etc.).
5. Idempotencia: si ya generó en últimas 24h, devuelve 409 con id del existente. `force=true` para saltar.

### 25–30 min: roadmap + Q&A

Roadmap del README:
- ✅ Backend + Frontend + DataSeeder idempotente + email vía Resend.
- ⚠️ Pendiente: wirear `/ranking` y `/votar` al backend, sitemap dinámico (hecho), tests E2E con Playwright.

Abre el suelo a preguntas.

---

## 🎤 Q&A defensivo (15 preguntas duras + respuestas)

**1. ¿Por qué Spring Boot y no Express/Fastify?**
> Spring Boot trae JPA + Security + Validation + Actuator + tests integrados desde el día 1. Para un proyecto educativo DAM con auth real y BBDD, evita 4-5 librerías Node + boilerplate. Java 21 además da virtual threads gratis para escalado.

**2. ¿Cómo manejas concurrencia en votos simultáneos?**
> El constraint `UNIQUE (enfrentamiento_id, usuario_id)` en la tabla `votos` lo blinda a nivel BBDD. Si dos votos del mismo usuario llegan en milisegundos, el segundo INSERT falla con SQLException, y el controlador lo traduce a 409. No necesito locks aplicativos.

**3. ¿Qué pasa si la BBDD se cae mientras un usuario vota?**
> El backend devuelve 500. El frontend muestra toast "Error en el servidor". El usuario reintenta. No tengo retry automático ni cola persistente — para portfolio es aceptable, en producción real metería un mensaje en RabbitMQ con DLQ.

**4. ¿Por qué ELO y no rating bayesiano?**
> ELO es lineal, deterministico y todo el mundo entiende cómo cambia. El bayesiano sería más exacto con pocos votos pero más opaco. Como esto es portfolio, transparencia > precisión.

**5. ¿Cómo escalarías a 1M de votos al día?**
> 1M/día = ~12 votos/seg. Lo hace cualquier Postgres modesto. Si pasara a 1M/min: cache de Redis para `/api/votos/ranking` (TTL 30s), Postgres con read replicas, votos vía cola Kafka procesados batch.

**6. ¿Por qué JWT y no sesiones?**
> Stateless, escala horizontal sin sticky sessions, no necesito Redis para almacenar sesiones. Coste: el JWT en localStorage es vulnerable a XSS — lo documento en `docs/SECURITY.md` como trade-off aceptado para portfolio.

**7. ¿Tests E2E?**
> Hoy 21 tests de integración (MockMvc + H2). E2E con Playwright está en el roadmap: requiere levantar Postgres + backend + frontend + Playwright en CI. Esfuerzo M, valor alto pero no bloqueante.

**8. ¿Cómo previenes bots votando?**
> Auth obligatoria: solo usuarios registrados con email válido pueden votar. UNIQUE (enfrentamiento, usuario) impide votar más de una vez. Sin captcha — para 1000 bots con emails reales no estaría blindado, pero es portfolio.

**9. ¿Por qué Resend y no Gmail SMTP?**
> Railway bloquea outbound SMTP (puertos 587 y 465 con timeout). Resend usa HTTPS puerto 443. Free tier 3000 emails/mes. Decisión documentada en commit `261f0a5`.

**10. ¿Qué hace el DataSeeder cuando la BBDD ya tiene datos?**
> Lee `personajes-seed.json`, hace `findAll()`, calcula el `Set<String>` de slugs existentes, filtra los del seed que NO están, los inserta con `saveAll()`. Es idempotente: arrancar 100 veces no duplica ni rompe nada.

**11. ¿Por qué Cloudflare Pages y no Vercel?**
> Vercel funcionó pero su DNS se resistió 3 días con un dominio custom. Cloudflare Pages: 1 click conectar GitHub, build verde, dominio gratis `*.pages.dev`. Free tier ilimitado en builds.

**12. ¿Qué pasa con el JWT_SECRET si lo descubre alguien?**
> Cualquier atacante podría generar tokens válidos. Mitigación: `JWT_SECRET` se genera con `openssl rand -base64 64` (256 bits), se guarda en variables de entorno de Railway (no en repo), y rotarlo invalida todos los tokens vivos forzando re-login.

**13. ¿Refresh tokens?**
> No. Acceso 1h, después re-login. Para portfolio es aceptable — implementar refresh tokens correctamente requiere blacklist server-side, lo cual rompe el "stateless" de JWT. En producción real con UX top, sí los metería.

**14. ¿Cómo añades un nuevo idioma al ranking?**
> Las descripciones viven en `frontend/src/data/personajes.js` con `descripcion: 'texto en español'`. Para i18n: añadiría `react-i18next` con archivos `/locales/es.json` y `/locales/en.json`. Backend devolvería personaje sin descripción y frontend la inyecta. Estaba en el plan, fuera de scope.

**15. ¿Qué fue lo más difícil del proyecto?**
> Detectar y migrar de SMTP a Resend. Los logs de Railway no decían "bloqueamos SMTP", solo "timeout 10000ms a smtp.gmail.com". Tuve que probar puertos 587 y 465 (ambos timeout), llegar a la hipótesis "Railway bloquea SMTP outbound", buscar alternativa HTTPS, encontrar Resend, registrarme, integrar `RestClient`, y validar end-to-end. 90 min de debug + 30 min de migración.

---

## 📦 Cosas a tener listas antes de la demo

- [ ] Pestañas precargadas: hero, catálogo, torneo concreto, ranking, swagger.
- [ ] User de demo logueado en localStorage para no perder tiempo en login.
- [ ] Postman colección abierta con ejemplo de POST /votar autenticado.
- [ ] Terminal con `cd backend && ./mvnw test` listo.
- [ ] `bash scripts/smoke-test.sh` corrido y resultado fresco.
- [ ] Wifi estable. Si falla: tener screenshots de respaldo en `docs/screenshots/`.
- [ ] AUDIT_REPORT.md cerrado en pestaña — por si el profe pregunta por puntos pendientes y queremos ser honestos.

---

**Recuerda:** confianza > marketing. Si no funciona algo en vivo, di "está documentado como pendiente en el roadmap, pasa a la siguiente demo". Mejor honesto que fingiendo.
