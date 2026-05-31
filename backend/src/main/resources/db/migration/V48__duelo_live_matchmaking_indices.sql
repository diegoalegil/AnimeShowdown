CREATE INDEX IF NOT EXISTS idx_duelos_live_estado_creado
    ON duelos_live (estado, creado_en);

CREATE INDEX IF NOT EXISTS idx_duelos_live_estado_elo_creado
    ON duelos_live (estado, jugador1_elo_before, creado_en);
