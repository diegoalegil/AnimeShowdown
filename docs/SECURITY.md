# Política de seguridad — AnimeShowdown

## Reportar una vulnerabilidad

Si encuentras una vulnerabilidad, **no la publiques en un issue público**. Avisa por privado:

- **Email:** diegogildam@gmail.com
- **Asunto:** `[security] AnimeShowdown — <título corto>`

Incluye:
- Descripción del problema.
- Pasos de reproducción exactos (URL, payload, headers).
- Impacto esperado (qué se podría conseguir si se explota).
- Sugerencia de fix si la tienes (opcional).

**Compromiso de respuesta:** acuso recibo en <72h, y propongo plan de mitigación o fecha de fix en <7 días para severidad alta. Para severidad baja, máximo 2 semanas.

---

## Modelo de amenaza

AnimeShowdown es un proyecto educativo de portfolio. **No procesa datos sensibles reales** (ni pagos, ni datos médicos, ni cuentas bancarias). El usuario máximo registra email + password + opcionalmente avatar como base64.

Activos a proteger:
1. **Cuenta de usuario** (email + password BCrypt) — un atacante no debe poder usurpar identidades para votar.
2. **Integridad del ranking** — los votos no deben ser falsificables a escala (1 voto por usuario por enfrentamiento, constraint UNIQUE en BBDD).
3. **Integridad del backend** — el atacante no debe poder DROP la tabla o leer secrets via `/actuator/*`.

Activos NO en alcance:
- DDoS volumétrico (Railway/Cloudflare cubren capa 3-4).
- Phishing de la página de login (no se puede prevenir desde la app).
- Compromiso del proveedor (Neon, Railway, Cloudflare).

---

## Controles implementados

### Autenticación
- Passwords hasheadas con **BCrypt** (`SecurityConfig.passwordEncoder()`).
- JWT firmado con HS256 + clave de **256 bits** (env `JWT_SECRET`).
- Tokens con expiración **1h** (env `JWT_EXPIRATION` = `3600000`ms).
- Reset de password por código numérico de 6 dígitos vía email (Resend), expira 15 min.

### Autorización
- Spring Security con filtro JWT (`JwtAuthFilter`) por request.
- Roles `USER` y `ADMIN`. ADMIN auto-promovido por env `ADMIN_EMAILS` (CSV).
- Rutas protegidas declaradas explícitamente en `SecurityConfig.securityFilterChain`:
  - `POST /api/personajes/*/votar` y `POST /api/enfrentamientos/*/votar` → `authenticated()`
  - `POST/PUT/DELETE /api/personajes/**` y `/api/torneos/**` → `hasRole("ADMIN")`
  - `/api/admin/**` → `hasRole("ADMIN")`
  - Resto del CRUD lectura → `permitAll()`

### Protecciones HTTP
- **CORS** restringido a orígenes conocidos: `localhost:5173`, `localhost:3000`, `animeshowdown.dev` y previews controladas de Cloudflare Pages. Sin wildcard global.
- **CSRF** desactivado a propósito porque la auth es JWT stateless (no cookies de sesión).
- **Headers en frontend** (configurados vía `frontend/public/_headers` para Cloudflare Pages):
  - `Content-Security-Policy` con whitelist explícita (Railway API + Jikan + AnimeChan).
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`.
  - `X-Frame-Options: DENY` (sin clickjacking).
  - `X-Content-Type-Options: nosniff`.
  - `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Permissions-Policy` bloqueando camera, microphone, geolocation, payment, USB, sensors.

### Validación de input
- DTOs con `@Valid` y constraints (`@NotBlank`, `@Email`, `@Size`, `@Pattern`).
- `Personaje.descripcion` y `Personaje.imagenUrl` con `@Column(length = 500)` — el avatar URL acepta hasta 500_000 chars (validación a mano en `AuthController.actualizarAvatar`).

### BBDD
- **PostgreSQL 17** (Neon) con conexión SSL forzada (`?sslmode=require` en JDBC URL).
- Constraints UNIQUE para evitar votos duplicados:
  - `UNIQUE (personaje_id, usuario_id)` en `votos`.
  - `UNIQUE (enfrentamiento_id, usuario_id)` en `votos`.
  - `UNIQUE (slug)` en `personajes`.
  - `UNIQUE (username)` y `UNIQUE (email)` en `usuarios`.

### Actuator
- `management.endpoints.web.exposure.include=health,info` — solo `/actuator/health` e `/actuator/info` expuestos. **Verificado:** `/actuator/env`, `/actuator/beans`, `/actuator/mappings`, `/actuator/heapdump`, `/actuator/threaddump` devuelven 404/vacío.

### Tests automáticos
- 21 tests con MockMvc + H2 que cubren:
  - Auth: registro válido, registro duplicado→409, login con creds inválidas→401, registro sin email→400, etc.
  - Torneos: control de acceso por rol, transiciones de estado válidas e inválidas.
  - Enfrentamientos: votar sin auth→403, voto duplicado→409, voto en torneo no activo→409.

### Smoke test post-deploy
- `scripts/smoke-test.sh` verifica los caminos críticos en <30s. Detecta 401 esperado en login con creds inválidas, BBDD seedeada, SPA routing.

---

## Riesgos conocidos y mitigación

| Riesgo | Severidad | Estado | Mitigación |
|---|---|---|---|
| **JWT en localStorage vulnerable a XSS** | Alta | ⚠️ Aceptado para portfolio | Si se renderiza HTML user-generated en el futuro, sanitizar. Mejor opción: cookie httpOnly + CSRF. |
| **Sin rate limiting en /login y /registro** | Alta | ❌ Pendiente | Añadir bucket4j o filtro custom. Brute-force factible. |
| **JWT_SECRET default predecible en application.properties** | Baja | ⚠️ Solo dev | En prod siempre se sobrescribe vía env. Cambiar default a `CHANGE_ME_IN_PROD`. |
| **Logs incluyen email completo en arranque** | Baja | ⚠️ Aceptado | Es propio email del owner; no es PII de usuarios. |
| **Personaje.descripcion limitada a 500 chars** | Baja | ⚠️ Por diseño | Las descripciones reales viven en frontend (`data/personajes.js`). Backend solo guarda nombre+slug+anime. |
| **Sin Refresh tokens, expira a 1h** | Media | ⚠️ Aceptado | El usuario re-loguea cada hora. Para portfolio educativo, aceptable. |

---

## Stack de dependencias revisado

Backend:
- Spring Boot 3.5.14 (Web, Data JPA, Security, Validation, Actuator)
- com.auth0:java-jwt 4.4.0
- springdoc-openapi 2.8.5
- PostgreSQL 17 driver

Frontend:
- React 19, Vite 8, react-router-dom 7
- Tailwind CSS v4
- Framer Motion 12
- Sonner 2.0.7, cmdk 1.1.1, lucide-react 1.14
- @react-three/fiber 9, drei 10, three 0.184

**Recomendación:** correr `./mvnw dependency-check:check` (OWASP) y `npm audit --omit=dev` antes de cada release. Documentar CVEs aceptados.

---

## Checklist pre-release

- [ ] `JWT_SECRET` en producción generado con `openssl rand -base64 64` (mínimo 256 bits).
- [ ] `RESEND_API_KEY` rotado anualmente.
- [ ] `DATABASE_URL` con SSL (`?sslmode=require`).
- [ ] Headers `_headers` desplegado en Cloudflare Pages.
- [ ] Smoke test verde tras cada deploy.
- [ ] `npm audit` sin vulnerabilidades altas/críticas.
- [ ] `./mvnw dependency-check:check` sin CVEs críticos.

---

**Última revisión:** 2026-05-10. Próxima revisión obligatoria: cuando se añada cualquier feature que toque auth, BBDD o input de usuario.
