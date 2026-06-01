# Migraciones

Las migraciones Flyway ya versionadas son inmutables: no se modifican, borran
ni renombran una vez publicadas porque Flyway valida su checksum al arrancar.
Para corregir schema se crea siempre una migracion nueva.

## Hueco reservado

`V43` es un hueco historico reservado. No se debe crear una migracion con esa
version ni reutilizarla en ramas nuevas. El guardrail de CI permite ese unico
hueco en el historial existente y sigue bloqueando cambios sobre migraciones ya
versionadas.
