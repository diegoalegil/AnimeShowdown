-- SEC-02 (resto legacy): los tokens de reset nuevos guardan solo BCrypt en
-- codigo_hash y redactan la columna codigo, pero las filas anteriores al fix
-- pueden conservar el código de 6 dígitos en claro. Se redactan todas.
UPDATE password_reset_tokens SET codigo = '******' WHERE codigo <> '******';

-- SEC-03: anti-replay TOTP. Se persiste el último step de 30s aceptado por
-- usuario; la validación rechaza cualquier código de un step <= al guardado.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS totp_ultimo_step BIGINT;
