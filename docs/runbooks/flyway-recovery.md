# Runbook — Flyway Recovery

Qué hacer cuando Flyway tira el backend al arrancar.

## La regla de oro

**Nunca modificar una migración Flyway que ya se aplicó en producción.**

Cada migración tiene un checksum calculado del contenido SQL. Si el contenido cambia tras aplicarse, Flyway aborta el arranque con `FlywayValidateException: Migration checksum mismatch`. El backend NO puede arrancar.

Si tienes que cambiar lo que hace una migración aplicada → crear una **migración nueva** `V(n+1)__nombre.sql` con el SQL correctivo (ALTER, DROP/CREATE, etc.).

CI tiene un guardrail (`scripts/check-flyway-migrations.sh`) que falla el PR si modificas una migración previa al base ref. **No lo desactives.**

## Estado actual del histórico

Última V conocida en `backend/src/main/resources/db/migration/`:

```bash
ls backend/src/main/resources/db/migration/ | sort -V | tail -1
```

La siguiente migración que añadas debe ser `V(último+1)__descripcion.sql`. No saltes números.

## Caso 1 — Backend crashea por checksum mismatch tras un deploy

**Síntoma** en logs de Railway:

```
Caused by: org.flywaydb.core.api.exception.FlywayValidateException:
  Validate failed: Migrations have failed validation
  Migration checksum mismatch for migration version 13
  -> Applied to database : 1067138252
  -> Resolved locally    : -1699309067
```

**Diagnóstico**: alguien editó el contenido del SQL de V13 después de que ya se aplicó en prod.

**Fix urgente**:

```bash
# 1. Localizar el commit que tocó la migración
git log --oneline -10 -- backend/src/main/resources/db/migration/V13__*.sql

# 2. Revertir el archivo a su estado pre-edición
git checkout <commit-anterior-bueno> -- backend/src/main/resources/db/migration/V13__*.sql

# 3. Commit del revert
git add backend/src/main/resources/db/migration/V13__*.sql
git commit -m "HOTFIX: revertir V13 — checksum mismatch crashea prod"
git push origin main

# 4. Railway redeploya, el checksum vuelve a matchear, backend arranca
```

Si lo que necesitabas cambiar en V13 sigue siendo necesario → crearlo como `V(n+1)__fix_v13_idempotente.sql` con el SQL correctivo (ej. `ALTER TABLE IF EXISTS ...` que la V13 original no tenía).

## Caso 2 — Migración nueva falla en prod (no en local)

**Síntoma**: backend crashea con error SQL al ejecutar la migración por primera vez.

**Posibles causas**:
- SQL no portable H2 vs Postgres (ej. `FUNCTION('DATE', ...)` funciona en PG, falla en H2)
- Falta `IF NOT EXISTS` en `CREATE INDEX` y ya existe del Hibernate auto-DDL anterior
- FK a tabla que no existe en prod (orden histórico de creación distinto)

**Fix**:

```bash
# 1. Identificar la migración fallida en logs Railway
# 2. Editarla EN LOCAL (aún no aplicada, no hay checksum issue)
# 3. Pushear el fix
# 4. Railway reintenta automáticamente
```

Si Railway YA aplicó la migración parcialmente y se quedó a medias (raro pero pasa con `ALTER TABLE` interrumpido):

```bash
# Conectar a Postgres prod y comprobar estado del schema
railway run psql $DATABASE_URL

# Ver historial Flyway:
SELECT * FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 5;

# Si hay fila con success=false: borrarla y arreglar manualmente el schema
DELETE FROM flyway_schema_history WHERE success = false;
```

⚠ **Solo el dueño/admin del DB hace esto. Documenta SIEMPRE qué borraste.**

## Caso 3 — Necesito limpiar todo y recrear schema en staging

```bash
# DROP completo (¡no en prod nunca!)
railway run --service animeshowdown-staging-db psql $DATABASE_URL \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Reiniciar backend → Flyway reaplicará V1..Vn desde cero
```

## Checklist pre-deploy con migración nueva

- [ ] La migración es V(n+1) consecutiva, no salté número
- [ ] El SQL es portable H2 + Postgres (probado con `./mvnw test`)
- [ ] Si toca tabla existente, uso `ALTER TABLE IF EXISTS ... DROP CONSTRAINT IF EXISTS ...`
- [ ] Si crea tabla nueva, índices, etc., uso `IF NOT EXISTS`
- [ ] No hay FK a tablas que no existen en V(n-1) o antes
- [ ] Tests locales pasan contra H2
- [ ] Comentario al principio explicando qué hace y por qué (review futuro)

## Comandos útiles

```bash
# Ver historia de migraciones aplicadas (local)
./mvnw flyway:info -Dflyway.url=jdbc:postgresql://localhost/...

# Validar migraciones sin aplicar
./mvnw flyway:validate

# Repair: marca una migración fallida como ok (¡cuidado, solo si sabes lo que haces!)
./mvnw flyway:repair
```
