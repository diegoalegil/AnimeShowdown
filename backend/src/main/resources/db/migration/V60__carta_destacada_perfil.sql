-- ===========================================================================
-- V60__carta_destacada_perfil.sql
-- Primer uso social de cartas: el usuario fija UNA carta que ya posee como
-- "destacada" en su perfil. La unicidad (una destacada por usuario) la
-- garantiza el service con un set-once que limpia la anterior en la misma
-- transacción — no usamos índice parcial (WHERE) porque H2 no lo soporta.
-- ===========================================================================

ALTER TABLE usuario_carta ADD COLUMN destacada BOOLEAN NOT NULL DEFAULT FALSE;

-- Localiza la destacada del usuario sin escanear toda su colección.
CREATE INDEX idx_usuario_carta_destacada ON usuario_carta (usuario_id, destacada);
