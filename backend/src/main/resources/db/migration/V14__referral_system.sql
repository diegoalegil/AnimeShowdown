-- Plan v2 §11.8 Referral system.
-- Cada usuario tiene un código único (8 chars, generado en registro).
-- Al registrarse otro usuario con ese código, queda registrado como
-- referido. El badge 'reclutador' (ya en seed V7) se desbloquea cuando
-- el usuario acumula 5+ referidos verificados.
--
-- referral_code es nullable temporalmente para usuarios existentes; se
-- rellena por backfill al primer arranque tras la migración.
-- referred_by_user_id es nullable (mayoría de users existentes no
-- vinieron por referral) y ON DELETE SET NULL para no perder el user
-- referido si el referrer borra su cuenta.

-- H2 (usado en tests) no admite múltiples ADD COLUMN en una sola
-- sentencia ALTER TABLE; separamos en dos.
ALTER TABLE usuarios ADD COLUMN referral_code VARCHAR(8);
ALTER TABLE usuarios ADD COLUMN referred_by_user_id BIGINT;

ALTER TABLE usuarios
    ADD CONSTRAINT fk_usuario_referrer
    FOREIGN KEY (referred_by_user_id) REFERENCES usuarios (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX idx_usuarios_referral_code ON usuarios (referral_code);
CREATE INDEX idx_usuarios_referred_by ON usuarios (referred_by_user_id);
