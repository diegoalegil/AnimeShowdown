ALTER TABLE password_reset_tokens
    ADD COLUMN codigo_hash VARCHAR(100);

ALTER TABLE password_reset_tokens
    ADD COLUMN intentos_fallidos INTEGER NOT NULL DEFAULT 0;

ALTER TABLE password_reset_tokens
    ADD COLUMN usado_en TIMESTAMP;

UPDATE password_reset_tokens
SET usado = TRUE,
    codigo = '******',
    usado_en = COALESCE(usado_en, CURRENT_TIMESTAMP)
WHERE codigo_hash IS NULL;

CREATE INDEX idx_prt_usuario_activo_creado
    ON password_reset_tokens (usuario_id, usado, creado_en);
