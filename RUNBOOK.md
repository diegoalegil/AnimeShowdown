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
| Backend API | Railway Hobby | $5/mes | Dominio: `api.animeshowdown.dev` |
| BBDD | Neon Postgres 17 (Frankfurt) | Sí (3GB) | Branch `main` |
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
   - Conexiones a Neon agotadas (HikariCP `pool exhaustion`).
   - Migración Flyway falló (V14+ logs `Migration of schema`).

**Respuesta**:
- **OOM**: reinicia el deploy desde Railway. Si recurrente, sube el plan o ajusta HikariCP `maximum-pool-size` (actual 8).
- **Pool exhaustion**: verifica si Neon está sano (https://console.neon.tech). Si sí, sube `maximum-pool-size` temporalmente.
- **Flyway**: lee el SQL de la migración fallida en `backend/src/main/resources/db/migration/`. Si es bug, corrige y redeploy. Si el estado de BBDD quedó inconsistente, marca la migración como reparada con `mvn flyway:repair` ANTES del siguiente boot.

**Fallback (~1h downtime)**: redeploy desde Docker Hub a Render free tier. Variables de entorno desde 1Password.

---

### 2. BBDD corrupta o caída (Neon)

**Síntoma**: backend logs muestran `JDBCConnectionException` continuo. Frontend muestra `500` en endpoints de catálogo.

**Diagnóstico**:
1. Consola Neon → estado del branch `main`.
2. Si está sano pero el backend no conecta: rota credenciales (`NEON_DATABASE_URL` en Railway).

**Restore (~4h downtime)**:
1. Identifica el último backup R2 OK: `daily/animeshowdown-YYYY-MM-DD.dump`.
2. Crea branch nuevo en Neon (no escribas sobre `main`).
3. Restaura: `pg_restore --format=custom --dbname=$NEW_DB_URL backup.dump`.
4. Apunta `NEON_DATABASE_URL` al branch nuevo en Railway.
5. Validar con smoke test (`/actuator/health` + `/api/personajes` cuenta=1052).

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
- Causa habitual: variantes responsive `-300.webp`/`-600.webp`/`-1024.webp`/`.avif` se colaron en `frontend/img/` y el sync las trató como personajes.
- Verifica: `find frontend/img -name "*-300.webp" | wc -l` → debe ser 0.

**Respuesta**:
```bash
find frontend/img -type f \( -name "*-300.webp" -o -name "*-600.webp" -o -name "*-1024.webp" -o -name "*.avif" \) -print
node scripts/sync-personajes.mjs --check
node scripts/qa/catalog-quality.mjs
```

Si aparecen variantes responsive dentro de `frontend/img/`, moverlas fuera del catálogo o eliminarlas solo tras revisar `git status`, `git diff --stat` y confirmar que no son assets fuente. El catálogo esperado es 1052 personajes.

---

### 6. Backups R2 desactualizados

**Síntoma**: el cron `db-backup` no aparece en GitHub Actions hace >2 días.

**Diagnóstico**:
1. `.github/workflows/db-backup.yml` — workflow status en GitHub.
2. Logs del último run: errores comunes:
   - `NEON_DATABASE_URL` expirada.
   - `R2_ACCESS_KEY_ID` rotado.
   - `pg_dump` versión no compatible con Neon 17.

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

## Smoke test post-deploy

Tras cada deploy a `main` (frontend + backend), ejecutar mentalmente:

1. `https://animeshowdown.dev` carga el Hero.
2. `https://api.animeshowdown.dev/actuator/health` → `{"status":"UP"}`.
3. `https://api.animeshowdown.dev/api/personajes` devuelve 1052 entries.
4. `https://api.animeshowdown.dev/api/votos/ranking` no vacío.
5. Login con cuenta admin → ver `/perfil` cargado.
6. Hard refresh (Cmd+Shift+R) para invalidar SW.

Si alguno falla: rollback inmediato desde dashboard provider (CF Pages / Railway).

---

## Contacto emergencia

- **Owner**: Diego Gil — diegogildam@gmail.com
- **GitHub**: https://github.com/diegoalegil/AnimeShowdown
- **Status pages**:
  - Cloudflare: https://www.cloudflarestatus.com/
  - Railway: https://status.railway.com/
  - Neon: https://status.neon.tech/
  - Resend: https://status.resend.com/

---

## Cambios recientes

- **2026-05-23**: hardening de producción: ranking personal local, misiones, comparador, sitemap/SEO y QA de catálogo/contraste.
- **2026-05-17**: referral system, light mode, time machine ELO, eliminación de cuenta GDPR y ranking ↑↓.
- **2026-05-17**: rebrand competitivo + fix imágenes producción.
- **2026-05-16**: cron automático de torneos cada 3 días.
- **2026-05-15**: backups R2 con rotación daily/weekly/monthly.

Mantener esta sección como log breve de cambios operativos significativos.
