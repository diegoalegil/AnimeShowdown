ALTER TABLE predicciones ADD COLUMN torneo_id BIGINT;
ALTER TABLE predicciones ADD COLUMN tipo VARCHAR(20) NOT NULL DEFAULT 'ENFRENTAMIENTO';
ALTER TABLE predicciones ALTER COLUMN enfrentamiento_id DROP NOT NULL;

ALTER TABLE predicciones
    ADD CONSTRAINT fk_pred_torneo
    FOREIGN KEY (torneo_id) REFERENCES torneos (id) ON DELETE CASCADE;

CREATE UNIQUE INDEX uk_pred_usuario_torneo_tipo
    ON predicciones (usuario_id, torneo_id, tipo);

CREATE INDEX idx_pred_torneo_tipo
    ON predicciones (torneo_id, tipo);
