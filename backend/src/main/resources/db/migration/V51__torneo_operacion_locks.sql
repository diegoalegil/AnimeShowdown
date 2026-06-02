CREATE TABLE IF NOT EXISTS torneo_operacion_locks (
    torneo_id BIGINT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_torneo_operacion_locks_torneo
        FOREIGN KEY (torneo_id) REFERENCES torneos (id) ON DELETE CASCADE
);

INSERT INTO torneo_operacion_locks (torneo_id)
SELECT id
FROM torneos
ON CONFLICT DO NOTHING;
