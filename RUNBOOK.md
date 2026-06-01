# Runbook operativo — AnimeShowdown

> Procedimientos para responder a incidentes y operar el proyecto de forma
> predecible. Mantener este documento actualizado tras
> cada incidente real o cambio significativo de infraestructura.

---

## Stack en producción

| Capa | Provider | Free? | Notas |
|---|---|---|---|
| DNS + Registrar | Cloudflare (`.dev`) | $10.44/año | TLD `.dev` fuerza HTTPS |
| CDN frontend | Cloudflare Pages | Sí | Build con `npm run build:no-images` (timeout 20 min) |
| CDN imágenes | Cloudflare/R2 público | Sí | `ANIMESHOWDOWN_IMG_CDN_BASE_URL` sirve el árbol público `/img/` |
| Backend API | Railway Hobby | $5/mes | Dominio: `api.animeshowdown.dev` |
| BBDD | Supabase Postgres 17 | Sí (free tier) | Session pooler IPv4 (Railway) |
| Email | Resend HTTP API | Sí (3k/mes) | Dominio verificado |
| Backups | Cloudflare R2 | Sí (10GB) | Cron diario, rotación daily/weekly/monthly |
| Observabilidad | Sentry (Web Vitals + JS errors) | Sí (5k/mes) | GDPR-safe defaults |

---

## Healthchecks

- **Frontend**: https://animeshowdown.dev — sirve `index.html` con SW workbox.
- **Backend health**: https://api.animeshowdown.dev/actuator/health → `{"status":"UP"}` si todo OK.
- **Detalle (auth requerida)**: configurado con `show-details=when-authorized` para usuarios con rol ACTUATOR_ADMIN.
- **Swagger UI**: https://api.animeshowdown.dev/swagger-ui/index.html — útil para smoke test manual.

---

## Procedimientos de incidente

### 1. Backend caído (Railway)

**Síntoma**: `/actuator/health` devuelve 5xx o no responde.

**Diagnóstico**:
1. Entra al dashboard de Railway → proyecto AnimeShowdown → Deployments.
2. Revisa **Logs** del deploy actual. Causas comunes:
   - OOM (heap >512MB). Mira `heap` events en logs.
   - Conexiones a Supabase agotadas (HikariCP `pool exhaustion`).
   - Migración Flyway falló (V14+ logs `Migration of schema`).

**Respuesta**:
- **OOM**: reinicia el deploy desde Railway. Si recurrente, sube el plan o ajusta HikariCP `maximum-pool-size` (actual 8).
- **Pool exhaustion**: verifica si Supabase está sano (dashboard de Supabase → Database). Si sí, sube `maximum-pool-size` temporalmente.
- **Flyway**: lee el SQL de la migración fallida en `backend/src/main/resources/db/migration/`. Si es bug, corrige y redeploy. Si el estado de BBDD quedó inconsistente, marca la migración como reparada con `mvn flyway:repair` ANTES del siguiente boot.

**Fallback (~1h downtime)**: redeploy desde Docker Hub a Render free tier. Variables de entorno desde 1Password.

---

### 2. BBDD corrupta o caída (Supabase)

**Síntoma**: backend logs muestran `JDBCConnectionException` continuo. Frontend muestra `500` en endpoints de catálogo.

**Diagnóstico**:
1. Dashboard de Supabase → Database → estado de la instancia y connection pooling.
2. Si está sano pero el backend no conecta: rota credenciales (`NEON_DATABASE_URL` en Railway — nombre legacy del secret, hoy apunta a Supabase).

**Restore (~4h downtime)**:
1. Identifica el último backup R2 OK: `daily/animeshowdown-YYYY-MM-DD.dump`.
2. Crea una instancia/proyecto Supabase nuevo (no restaures sobre el de producción).
3. Restaura: `pg_restore --format=custom --dbname=$NEW_DB_URL backup.dump`.
4. Apunta `NEON_DATABASE_URL` (secret legacy) a la instancia nueva en Railway.
5. Validar con smoke test (`/actuator/health` + `/api/personajes` cuenta=1086).

---

### 3. Cloudflare DNS caído

**Síntoma**: `animeshowdown.dev` resuelve a NXDOMAIN. Backend sigue funcionando si pingueas a `api.animeshowdown.dev` directo.

**Fallback (~30min)**:
1. Cambia nameservers en Cloudflare Registrar a Namecheap secondary.
2. Importa la zona DNS desde el último export (mantener en 1Password).
3. Propagación 5-30 min según TTLs.

---

### 4. Resend cae (emails no salen)

**Síntoma**: `EmailService` loguea `[EMAIL FALLBACK]` masivamente. Usuarios reciben "Email enviado" en UI pero nunca llega.

**Diagnóstico**:
1. https://status.resend.com — si está caído, esperar.
2. Si está OK: verifica `RESEND_API_KEY` en Railway env vars. Posible rotación de key.

**Respuesta**:
- El backend tiene `email_failed_queue` (V4): los emails fallidos se persisten. Cuando Resend vuelva, manualmente reenvíalos con `POST /api/admin/emails/reintentar-cola`.
- Para verificaciones nuevas: usuarios pueden re-pedir el link desde `/verify`.

---

### 5. Catálogo de personajes inconsistente

**Síntoma**: usuarios reportan personajes con imagen rota o con nombre extraño tipo "Akame-300".

**Diagnóstico**:
- Causa habitual: imagen fuente renombrada sin actualizar seed, slug duplicado o archivo no WebP en una carpeta de anime.
- Las variantes responsive `-300.webp`/`-600.webp`/`-1024.webp`/`.avif` pueden existir en `frontend/img/`; `sync-personajes.mjs` las ignora explícitamente y no deben contarse como personajes.

**Respuesta**:
```bash
node scripts/sync-personajes.mjs --check
node scripts/qa/catalog-quality.mjs
```

Si el `--check` falla, revisa los slugs indicados y corrige seed/imagen de forma explícita. No elimines variantes responsive ni imágenes de personajes por ausencia de imports directos: se resuelven por ruta dinámica. El catálogo esperado es 1086 personajes. Para comprobar el conteo canónico del seed:

```bash
jq 'length' backend/src/main/resources/personajes-seed.json
```

Para producción, `frontend/img/` no viaja dentro del artefacto de Cloudflare Pages. El build `npm run build:no-images` exige:

```bash
ANIMESHOWDOWN_IMG_CDN_BASE_URL=https://assets.animeshowdown.dev/img
```

Ese origen debe contener el mismo árbol relativo que la app expone bajo `/img/`: catálogo desde `frontend/img/` y stage assets desde `frontend/public/img/`. Ejemplo: `/img/One_Piece/luffy.webp` en la app redirige a `https://assets.animeshowdown.dev/img/One_Piece/luffy.webp`. Si falta la variable, el build se aborta para no publicar una SPA con imágenes rotas.

El plan local de sincronización no toca remoto:

```bash
cd frontend
npm run assets:cdn:plan
```

La subida real usa `scripts/sync-img-cdn.mjs` y requiere secretos dedicados:

- `ANIMESHOWDOWN_IMG_CDN_BASE_URL`
- `R2_IMG_ENDPOINT`
- `R2_IMG_ACCESS_KEY_ID`
- `R2_IMG_SECRET_ACCESS_KEY`
- `R2_IMG_BUCKET`
- `R2_IMG_PREFIX` (`img` por defecto)

Desde GitHub Actions, usa el workflow manual **IMG CDN sync**. El input `apply=false` solo imprime el plan; `apply=true` sube cambios. El script no ejecuta `--delete` contra el bucket para evitar borrados accidentales.

---

### 6. Backups R2 desactualizados

**Síntoma**: el cron `db-backup` no aparece en GitHub Actions hace >2 días.

**Diagnóstico**:
1. `.github/workflows/db-backup.yml` — workflow status en GitHub.
2. Logs del último run: errores comunes:
   - `NEON_DATABASE_URL` expirada.
   - `R2_ACCESS_KEY_ID` rotado.
   - `pg_dump` versión no compatible con Postgres 17.

**Respuesta**:
- Rota secrets si fueron expirados (los 4 keys de R2 + `NEON_DATABASE_URL`).
- Lanza manualmente: GitHub Actions → db-backup → Run workflow.

---

### 7. Eliminación de cuenta (GDPR)

Si un usuario pide ejercer derecho de eliminación (art. 17 GDPR) por email:

1. **Auto-servicio**: el usuario puede hacerlo desde `/perfil` → tab Ajustes → "Eliminar mi cuenta" con doble confirmación de password.
2. **Por petición manual** (raro, ej. perdió acceso):
   - Verifica identidad pidiendo email del registro + último voto registrado.
   - Ejecuta SQL: `DELETE FROM usuarios WHERE id = X;` (cascada automática: votos quedan anónimos, predicciones/logros/follows/refresh tokens/notifs se borran).
   - Audit log lo recoge automáticamente (`CUENTA_ELIMINADA`).
   - Responde al usuario confirmando en <30 días.

---

### 8. Spike de tráfico (rate-limit alcanzado)

**Síntoma**: usuarios reportan 429 al votar o registrarse.

**Diagnóstico**:
- `RateLimitFilter` actual: 5/min + 50/h por IP en rutas críticas.
- Logs del backend con `RateLimit excedido ip=...` indican qué IP/ruta.

**Respuesta**:
- Si es atacante: bloquear IP en Cloudflare WAF (Rules → IP Access Rules).
- Si es legítimo (lanzamiento viral): subir temporalmente `Bandwidth.simple()` en `RateLimitFilter` y redeploy. Volver a 5/50 cuando baje el pico.

---

### 9. Torneo bloqueado (sin avanzar)

**Síntoma**: torneo en `IN_PROGRESS` no avanza de ronda aunque todos votaron.

**Diagnóstico**:
- Verifica `enfrentamientos` del torneo: ¿todos tienen `ganador_id`? Si sí, falta el listener que crea la siguiente ronda.

**Respuesta**:
- Admin: `POST /api/torneos/{id}/avanzar` o, si no existe el endpoint, forzar avance vía Swagger.
- Verifica `BracketService` logs por errores en el promote.

---

### 10. Cartas, monedero y sobres

**Síntoma**: `/cartas` no carga colección, el usuario no puede abrir sobre o el saldo no cuadra.

**Diagnóstico**:
- Endpoints autenticados principales: `GET /api/me/cartas`, `GET /api/me/monedero`, `GET /api/cartas/odds`, `POST /api/me/cartas/sobre`, `POST /api/me/cartas/cofre-diario`, `GET /api/me/cartas/{cartaId}/descargar`.
- La apertura de sobre debe enviar `X-Idempotency-Key`; si se reintenta la misma key, el backend devuelve la misma apertura persistida.
- El backend es autoridad única de saldo, pity, duplicados y propiedad. No ajustes saldo ni colección desde el cliente.
- Tablas relevantes: `carta`, `usuario_carta`, `usuario_carta_pity`, `sobre_apertura`, `sobre_apertura_item`, `monedero`, `monedero_movimiento`.

**Respuesta**:
- Revisa logs de `CartaService`, `MonederoService` y `CartaDownloadService`.
- Si hay 409 al abrir sobre, confirma saldo con `GET /api/me/monedero` y movimientos recientes.
- Si una descarga falla con 403, comprobar que existe relación en `usuario_carta`.
- Si falla el catálogo de cartas tras importar personajes, ejecutar `node scripts/sync-personajes.mjs --check` y reiniciar backend para resembrar catálogo derivado.

---

### 11. Fantasy Showdown

**Síntoma**: `/fantasy` no permite guardar equipo, no bloquea draft o el leaderboard sale vacío.

**Diagnóstico**:
- Endpoints: `GET /api/fantasy/me`, `GET /api/fantasy/candidatos`, `PUT /api/fantasy/me/equipo`, `POST /api/fantasy/me/equipo/lock`, `GET /api/fantasy/leaderboard`.
- El draft semanal usa 5 slots y presupuesto server-side (`app.fantasy.presupuesto`, default 100). Los candidatos se filtran por búsqueda y limit.
- Solo los equipos bloqueados entran en leaderboard. La semana se identifica en formato ISO (`YYYY-Www`).
- Tablas relevantes: `fantasy_equipo`, `fantasy_equipo_item`.

**Respuesta**:
- Si `PUT /api/fantasy/me/equipo` devuelve 400, revisar número de personajes, duplicados y coste total.
- Si `POST /api/fantasy/me/equipo/lock` devuelve 404, el usuario no guardó draft para la semana activa.
- Si devuelve 409, el equipo ya estaba bloqueado y debe tratarse como estado final.
- Para inspección operativa, comparar `GET /api/fantasy/me` autenticado con `GET /api/fantasy/leaderboard?semanaIso=<semana>&limit=50`.

---

## Smoke test post-deploy

Tras cada deploy a `main` (frontend + backend), ejecutar mentalmente:

1. `https://animeshowdown.dev` carga el Hero.
2. `https://api.animeshowdown.dev/actuator/health` → `{"status":"UP"}`.
3. `https://api.animeshowdown.dev/api/personajes` devuelve 1086 entries.
4. `https://api.animeshowdown.dev/api/votos/ranking` no vacío.
5. Login con cuenta admin → ver `/perfil` cargado.
6. Con la misma sesión, `/cartas` muestra colección/saldo y `GET /api/cartas/odds` responde 200.
7. `/fantasy` carga resumen semanal y `GET /api/fantasy/leaderboard` responde JSON.
8. Hard refresh (Cmd+Shift+R) para invalidar SW.

Si alguno falla: rollback inmediato desde dashboard provider (CF Pages / Railway).

## E2E local seguro

Para validar Playwright con backend real sin tocar Postgres local:

```bash
cd backend
SPRING_PROFILES_ACTIVE=e2e ./mvnw spring-boot:run -Dspring-boot.run.useTestClasspath=true

cd ../frontend
npm run build:e2e
npm run preview -- --host 127.0.0.1
npm run test:e2e:local
```

`build:e2e` fija `VITE_API_URL` a `http://127.0.0.1:8080` por defecto. Sin esa variable, el build de producción bloquea el arranque del cliente para evitar fallback silencioso a una API real.
El flag `useTestClasspath` mantiene H2 fuera del artefacto productivo y aun así permite usarlo en QA local.

---

## Contacto emergencia

- **Owner**: Diego Gil — diegogildam@gmail.com
- **GitHub**: https://github.com/diegoalegil/AnimeShowdown
- **Status pages**:
  - Cloudflare: https://www.cloudflarestatus.com/
  - Railway: https://status.railway.com/
  - Supabase: https://status.supabase.com/
  - Resend: https://status.resend.com/

---

## Cambios recientes

- **2026-05-28**: migración de BBDD de Neon a Supabase (Postgres 17, session pooler IPv4). El secret `NEON_DATABASE_URL` conserva el nombre legacy.
- **2026-05-23**: hardening de producción: ranking personal local, misiones, comparador, sitemap/SEO y QA de catálogo/contraste.
- **2026-05-17**: referral system, time machine ELO, eliminación de cuenta GDPR y ranking ↑↓. (El light mode opt-in se retiró después.)
- **2026-05-17**: rebrand competitivo + fix imágenes producción.
- **2026-05-16**: cron automático de torneos cada 3 días.
- **2026-05-15**: backups R2 con rotación daily/weekly/monthly.

Mantener esta sección como log breve de cambios operativos significativos.
