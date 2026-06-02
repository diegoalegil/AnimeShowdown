-- Bucket atomico de rate limit para comentarios por usuario y hora.
-- Evita el patron count-then-insert bajo requests concurrentes.

CREATE TABLE comentario_rate_limit (
    usuario_id       BIGINT    NOT NULL,
    ventana_inicio  TIMESTAMP NOT NULL,
    usados          INTEGER   NOT NULL DEFAULT 0,
    actualizado_en  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, ventana_inicio),
    CONSTRAINT fk_comentario_rate_limit_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
);

CREATE INDEX idx_comentario_rate_limit_actualizado
    ON comentario_rate_limit (actualizado_en);
