ALTER TABLE torneos
    ADD COLUMN publico BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE torneos
SET publico = TRUE
WHERE estado_revision IN ('NO_APLICA', 'APROBADO')
   OR visibilidad = 'PUBLICO';

CREATE INDEX IF NOT EXISTS idx_torneos_publico_revision
    ON torneos (publico, estado_revision);
