-- Plan v2 §4.1 — endpoint DELETE /api/perfil/me con confirmación de
-- contraseña (GDPR right to erasure). Para que el borrado del usuario
-- pueda completarse en una sola transacción, las FK con DEFAULT RESTRICT
-- pasan a CASCADE (datos derivados que ya no tienen sentido sin el
-- usuario) o SET NULL (datos agregados que sí queremos preservar).
--
-- Estado de cada FK a usuarios antes de esta migración:
--
-- Ya estaban OK:
--   - usuario_logros, predicciones, reacciones, notificaciones,
--     totp_backup_codes, seguidores → ON DELETE CASCADE
--   - audit_log, torneos.created_by_user_id → ON DELETE SET NULL
--
-- Pendientes (esta migración):
--   - votos.usuario_id      → SET NULL (preserva el voto como anónimo
--     para no romper el ranking agregado del personaje).
--   - refresh_tokens         → CASCADE (sin user, el token no sirve).
--   - email_verifications    → CASCADE (sin user, la verificación no
--     se puede aplicar a nadie).
--
-- password_reset_tokens.usuario_id no tiene FK declarada (legacy V1);
-- los tokens huérfanos quedan inofensivos hasta que expiran solos.

-- Votos: preserva la fila como voto anónimo.
ALTER TABLE votos DROP CONSTRAINT fk_voto_usuario;
ALTER TABLE votos
    ADD CONSTRAINT fk_voto_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL;

-- Refresh tokens: sin usuario el token es basura, borra en cascada.
ALTER TABLE refresh_tokens DROP CONSTRAINT fk_refresh_usuario;
ALTER TABLE refresh_tokens
    ADD CONSTRAINT fk_refresh_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE;

-- Email verifications: pendiente sin usuario = ruido en la tabla.
ALTER TABLE email_verifications DROP CONSTRAINT fk_email_verif_usuario;
ALTER TABLE email_verifications
    ADD CONSTRAINT fk_email_verif_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE;
