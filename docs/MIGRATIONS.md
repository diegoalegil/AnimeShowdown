# Migraciones

Las migraciones Flyway ya versionadas son inmutables: no se modifican, borran
ni renombran una vez publicadas porque Flyway valida su checksum al arrancar.
Para corregir el schema se crea siempre una migracion nueva con la siguiente
version libre.

## Huecos historicos

El historial tiene huecos de version intencionados que NO deben reutilizarse:

- `V43`: hueco reservado durante el sprint de olas; nunca llego a usarse.
- `V59`: la numeracion salto a `V60`/`V61` al integrar features en paralelo.

Flyway no exige numeracion contigua: aplica las versiones existentes en orden
ascendente y un hueco no rompe nada mientras no exista una migracion con una
version inferior a la maxima ya aplicada (eso si seria un fallo de orden). No
se debe crear una migracion que reutilice `V43` ni `V59`.
