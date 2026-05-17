-- Plan v2 §1.1/§17.1 cleanup tardío.
--
-- En algún momento se renombró el enum EstadoTorneo en código Java de
-- los valores en español (BORRADOR/ACTIVO/FINALIZADO) a los estándar
-- en inglés (SCHEDULED/IN_PROGRESS/FINISHED). Se actualizaron todos los
-- callers pero NUNCA se migró el CHECK constraint de la tabla — que
-- Hibernate había creado en su día con los nombres antiguos cuando
-- corría con ddl-auto=update.
--
-- Resultado en producción: los INSERT desde DataSeeder con estado
-- 'FINISHED' fallaban con:
--   ERROR: new row for relation "torneos" violates check constraint
--   "torneos_estado_check"
--
-- Los tests pasaban porque H2 nunca tuvo ese CHECK (V1 no lo declara y
-- ddl-auto en tests no lo añade explícitamente).
--
-- Fix:
--   1. Migra cualquier fila con valor antiguo al nuevo (no-op si ya
--      están todas en inglés).
--   2. Dropea el CHECK legacy (IF EXISTS para tolerar entornos donde
--      nunca se creó, como H2).
--   3. Crea el CHECK explícito con los valores en inglés — defensa en
--      profundidad sobre la validación @Enumerated(STRING) del modelo.

UPDATE torneos SET estado = 'SCHEDULED'   WHERE estado = 'BORRADOR';
UPDATE torneos SET estado = 'IN_PROGRESS' WHERE estado = 'ACTIVO';
UPDATE torneos SET estado = 'FINISHED'    WHERE estado = 'FINALIZADO';

ALTER TABLE torneos DROP CONSTRAINT IF EXISTS torneos_estado_check;
ALTER TABLE torneos
    ADD CONSTRAINT torneos_estado_check
    CHECK (estado IN ('SCHEDULED', 'IN_PROGRESS', 'FINISHED'));
