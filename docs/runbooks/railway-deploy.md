# Runbook — Despliegue Railway (backend)

Procedimientos operativos para deployar y operar el backend de AnimeShowdown en Railway.

## Contexto

- **Servicio backend**: Railway
- **Dominio público**: `api.animeshowdown.dev`
- **Stack**: Spring Boot 3.5 + Java 21 + PostgreSQL 17
- **Build**: Railway detecta `backend/pom.xml`, ejecuta `./mvnw -DskipTests package`, arranca con `java -jar target/*.jar`
- **Push a `main` → deploy automático** vía webhook GitHub

## Flujo de despliegue normal

1. Merge a `main`.
2. Railway recibe webhook, encola build.
3. Maven compila + crea jar (~2-3min).
4. Railway arranca nuevo contenedor, espera health-check `/actuator/health` 200.
5. Cambia el routing del dominio al contenedor nuevo (zero-downtime).
6. Si el health-check falla 3 veces → deploy abortado, sigue corriendo el contenedor anterior.

Verificar el deploy:

```bash
# Health
curl -s https://api.animeshowdown.dev/actuator/health | jq '.status'
# Debe devolver: "UP"

# Versión actual (commit hash si lo expones, o build-info)
curl -s https://api.animeshowdown.dev/actuator/info | jq

# Métrica básica: nº de votos totales (requiere token de scrape)
curl -s -H "X-Prometheus-Token: $APP_PROMETHEUS_SCRAPE_TOKEN" \
  https://api.animeshowdown.dev/actuator/prometheus | grep as_votos_total
```

## Rollback de emergencia

Si un deploy nuevo crashea o introduce regresión:

**Opción A — Rollback vía Railway dashboard (recomendado, 1 click):**
1. Dashboard → AnimeShowdown service → Deployments
2. Localizar el último deploy verde (icono check verde)
3. `⋮ → Redeploy` sobre ese commit
4. Esperar 2-3min hasta health-check 200

**Opción B — Revert + push (cuando dashboard no responde):**
```bash
cd ~/Desktop/Repos-Github/AnimeShowdown
git log --oneline -10  # localizar commit malo
git revert <hash-malo>
git push origin main
# Railway detecta push, deploya el revert, ~3min
```

**Opción C — Pin a commit anterior:**
```bash
git push origin <hash-bueno>:main --force-with-lease
# Riesgo: pierdes commits posteriores no en otro branch. Solo si A y B no van.
```

## Checklist post-rollback

- [ ] `curl /actuator/health` → 200 UP
- [ ] Login funciona: `curl -X POST /api/auth/login -d '...'` → 200 + token
- [ ] Voto funciona: `POST /api/enfrentamientos/:id/votar` → 200 + ELO actualizado
- [ ] Rankings funcionan: `GET /api/votos/ranking` → array
- [ ] Logs en Railway: sin stack traces nuevos en los últimos 5min
- [ ] Sentry (cuando esté): sin nuevos issues en los últimos 5min
- [ ] Notificar al canal de Slack/Discord con commit revertido + motivo

## Triage de un crash en arranque

Si Railway loguea `APPLICATION FAILED TO START`:

1. **Leer la línea `Caused by:`** del log — Spring siempre marca la cadena de excepciones.
2. **Caso Flyway checksum mismatch** → ver `flyway-recovery.md`.
3. **Caso bean creation failure** → suele ser:
   - `JdbcSQLException`: BBDD inaccesible. Verificar Railway DB add-on running.
   - `Connection refused`: revisar `DATABASE_URL` en Variables.
   - `LinkageError`: jar corrupto. Forzar rebuild (Empty commit + push).
4. **Caso OOM** (`OutOfMemoryError`): subir plan o reducir caches en `application.properties` (`spring.cache.caffeine.spec=maximumSize=500`).

## Variables de entorno críticas

Configuradas en Railway → Variables (NO en código):

| Var | Para qué | Si falta |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Crash inmediato |
| `JWT_SECRET` | Firma de tokens | Crash inmediato |
| `CORS_ALLOWED_ORIGINS` | Frontends permitidos | OAuth/login rompen |
| `RESEND_API_KEY` | Emails verificación | Modo offline (log fallback) |
| `OAUTH_GOOGLE_CLIENT_*` | Login Google | OAuth Google falla 500 |
| `OAUTH_DISCORD_CLIENT_*` | Login Discord | OAuth Discord falla 500 |

## Reglas de oro

- **Nunca tocar migraciones aplicadas** (V1..Vn que ya pasaron por prod). Si necesitas cambio de schema, **nueva V(n+1)**. Romper esto = backend crashea por checksum mismatch.
- **Nunca pushear con `--force` a `main`** sin coordinarlo con el equipo.
- **Health-check first**: si añades una nueva dependencia externa (Redis, API tercera), añadirla al `/actuator/health` para que Railway sepa si está sana.
- **Logs son la única fuente de verdad**: si no aparece en Railway logs, no pasó.
- **Cuota gratuita de Railway**: 500h de ejecución/mes en plan free. Si pasas a paid, asegúrate de monitorear costes.
