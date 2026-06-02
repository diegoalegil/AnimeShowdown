# MAINTENANCE — mantenimiento operativo

Guía de **mantenimiento recurrente** de AnimeShowdown: flags de apagado en
caliente, trabajos programados, política de dependencias, backups, smoke test y
monitorización. Para procedimientos puntuales (deploy, restauración de BBDD,
incidentes) ver [`RUNBOOK.md`](RUNBOOK.md); para arquitectura, [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

> Convención: casi todo se apaga/ajusta por **variable de entorno** sin redeploy
> de código. El backend corre en Railway; el frontend en Cloudflare Pages.

## 1. Feature flags / kill-switches

Toggles del backend (`application.properties`). Cambiar la env var en Railway y
reiniciar el servicio basta — no requiere redeploy de código.

| Env var | Default | Qué controla |
|---|---|---|
| `RATELIMIT_ENABLED` | `true` | Rate-limit de la API. Apagar solo en incidente puntual. |
| `STATUS_MONITOR_ENABLED` | `true` | Sondas de uptime que alimentan `/api/status`. |
| `TOURNAMENT_AUTO_ENABLED` | `true` | Generación automática de torneos (cron externo). |
| `AUDIT_CLEANUP_ENABLED` | `true` | Purga programada del audit log. |
| `TURNSTILE_ENABLED` | `false` | Verificación Cloudflare Turnstile en voto invitado. |
| `PROMETHEUS_ENABLED` | `true` | Export de métricas Prometheus. |
| `REDIS_HEALTH_ENABLED` | `false` | Incluir Redis en `/actuator/health`. |
| `SERVER_COMPRESSION_ENABLED` | `true` | Compresión de respuestas HTTP. |

> El scheduler de avance de torneos (`app.torneos.auto-advance.enabled`) está
> activo por defecto aunque no se defina la var (`matchIfMissing`). Para apagarlo
> hay que ponerlo explícitamente en `false`.

## 2. Trabajos programados

### En proceso (`@Scheduled`, dentro del backend)

| Job | Cadencia | Apagado |
|---|---|---|
| `StatusMonitorService` | cada intervalo configurado, arranque +15s | `STATUS_MONITOR_ENABLED=false` |
| `TorneoAutoAdvanceJob` | cada 15s (arranque +60s) | `app.torneos.auto-advance.enabled=false` |
| `AuditLogCleanupJob` | diario `0 0 3 * * *` UTC | `AUDIT_CLEANUP_ENABLED=false` |
| `FantasyShowdownService` (cierre semanal) | lunes `0 5 0 * * MON` UTC | — |
| `DueloLiveService` (fallback matchmaking) | cada 5s | `DUEL_LIVE_FALLBACK_AFTER_SECONDS` ajusta el umbral |

### GitHub Actions programadas / operativas

| Workflow | Disparo | Función |
|---|---|---|
| `auto-tournament.yml` | cron `0 9 */3 * *` | Llama `POST /api/cron/torneos/auto-generar` con `X-Cron-Secret`. |
| `db-backup.yml` | cron `04:00` UTC | `pg_dump` + rotación (`scripts/backup-and-rotate.sh`). |
| `lighthouse.yml` | push a `main` | Presupuestos de performance (FCP/LCP/CLS). |
| `test.yml`, `e2e.yml`, `migration-guard.yml`, `pr-hygiene.yml`, `image-variants.yml` | pull request | Gates de CI (no operativos). |
| `img-cdn-sync.yml` | `workflow_dispatch` | Sincronización manual de imágenes al CDN. |

El secreto del cron (`auto-tournament.yml`) usa `CRON_SECRET` en *Actions secrets*
y debe coincidir con `APP_CRON_SECRET` en Railway. Si rotas uno, rota el otro.

## 3. Dependencias (Dependabot)

Config en [`.github/dependabot.yml`](.github/dependabot.yml). Escaneo **semanal**
(lunes 06:00 Europe/Madrid) para npm (`/frontend`) y Maven (`/backend`), agrupado.

- **Patches/minors** que pasen CI: candidatos a merge tras revisión rápida.
- **Majors**: quedan como PR abierto para review manual (posibles breaking changes
  que el CI no detecta).
- Si un paquete satura la cola con releases muy frecuentes, añadir un `ignore`
  con `update-types: ["version-update:semver-patch"]`.

Mantenimiento: revisar la cola de Dependabot al menos una vez por semana; no dejar
majors acumularse (Spring Boot tiene ventanas de soporte acotadas).

## 4. Backups y restauración

- **Backup**: automático con `db-backup.yml` (diario, 04:00 UTC) →
  `scripts/backup-and-rotate.sh` (`pg_dump --format=custom` + rotación).
- **Restauración / restore drill**: procedimiento en [`RUNBOOK.md`](RUNBOOK.md)
  (`pg_restore --format=custom`). Conviene ejecutar un *restore drill* periódico
  contra una BBDD desechable para validar que los dumps son restaurables.

## 5. Smoke test post-deploy

`scripts/smoke-test.sh` verifica los caminos críticos en <30s contra producción
(health, conteo de personajes, ranking, votar, torneos, cartas, OG). Ejecutar tras
cada deploy:

```bash
bash scripts/smoke-test.sh
```

El catálogo esperado es **1086 personajes** (`EXPECTED_PERSONAJES`); ver el conteo
canónico con `jq 'length' backend/src/main/resources/personajes-seed.json`.

## 6. Monitorización y alerting

- **Sentry**: errores de frontend y backend. El replay de sesión solo se graba
  **on-error** (`replaysSessionSampleRate=0`), por privacidad y cuota.
- **Health**: `GET /actuator/health` (lo usa el smoke test y Railway).
- **Uptime / status**: `StatusMonitorService` → `GET /api/status`.
- **Métricas**: Prometheus en `/actuator/prometheus` (si `PROMETHEUS_ENABLED`).

## 7. Secretos y entorno

- **Backend** (Railway → Variables): `*_DATABASE_URL`, `APP_CRON_SECRET`,
  credenciales de email/VAPID/Turnstile, etc.
- **Frontend** (Cloudflare Pages → Environment): `VITE_*`.
- **CI** (GitHub → Actions secrets): `API_URL`, `CRON_SECRET`, credenciales de backup.

Rotación: al rotar un secreto compartido (p.ej. `APP_CRON_SECRET` ↔ `CRON_SECRET`),
actualizar **ambos** lados en la misma ventana para no romper el cron.

## 8. Migraciones de base de datos

- Las migraciones Flyway aplicadas son **inmutables**: nunca editar/borrar/renumerar
  una existente. Para corregir esquema se crea una migración **nueva** con el
  siguiente número libre.
- `V43` es un hueco histórico reservado (no reutilizar). El guardrail de CI
  (`migration-guard.yml`) bloquea cambios sobre migraciones ya aplicadas.

## 9. Checklist de mantenimiento

**Semanal**
- [ ] Revisar cola de Dependabot (mergear patches/minors verdes, valorar majors).
- [ ] Echar un ojo a Sentry (errores nuevos recurrentes).
- [ ] Confirmar que el último `db-backup.yml` corrió en verde.

**Mensual**
- [ ] Restore drill de un backup reciente contra BBDD desechable.
- [ ] Repasar versiones EOL (Spring Boot, Node, Postgres) y planificar upgrades.
- [ ] Verificar que los smoke tests siguen cubriendo los caminos críticos vivos.
