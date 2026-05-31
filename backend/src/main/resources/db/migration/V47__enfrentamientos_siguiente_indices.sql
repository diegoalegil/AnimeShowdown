-- Hot path de /api/enfrentamientos/siguiente.
-- Portable Postgres + H2: sin indices parciales para que Flyway valide igual.
CREATE INDEX IF NOT EXISTS idx_torneos_estado_id
    ON torneos (estado, id);

CREATE INDEX IF NOT EXISTS idx_enfrentamientos_siguiente
    ON enfrentamientos (ganador_id, id, torneo_id);
