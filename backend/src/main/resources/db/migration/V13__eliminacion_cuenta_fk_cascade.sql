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
--
-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ NOTAS DE DIALECTO                                                   │
-- │                                                                     │
-- │ Esta migración corre contra dos dialectos (H2 en tests, Postgres   │
-- │ en prod) y los constraints pueden tener nombres diferentes:        │
-- │                                                                     │
-- │   - H2 honra el nombre declarado en V1 (fk_voto_usuario, etc.).    │
-- │   - Postgres si V1 corrió contra una BBDD ya creada por Hibernate  │
-- │     en `ddl-auto=update` antes de Flyway, el constraint tiene      │
-- │     nombre auto-generado por Postgres tipo `votos_usuario_id_fkey` │
-- │     (patrón {table}_{column}_fkey).                                │
-- │                                                                     │
-- │ Para que la migración sea robusta en ambos casos usamos             │
-- │ DROP CONSTRAINT IF EXISTS con los DOS nombres posibles. Solo uno   │
-- │ existirá; el otro es no-op. Luego se crea el nuevo con el nombre   │
-- │ estable que el resto del schema espera.                            │
-- └─────────────────────────────────────────────────────────────────────┘

-- Votos: preserva la fila como voto anónimo.
ALTER TABLE votos DROP CONSTRAINT IF EXISTS fk_voto_usuario;
ALTER TABLE votos DROP CONSTRAINT IF EXISTS votos_usuario_id_fkey;
ALTER TABLE votos
    ADD CONSTRAINT fk_voto_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL;

-- Refresh tokens: sin usuario el token es basura, borra en cascada.
ALTER TABLE refresh_tokens DROP CONSTRAINT IF EXISTS fk_refresh_usuario;
ALTER TABLE refresh_tokens DROP CONSTRAINT IF EXISTS refresh_tokens_usuario_id_fkey;
ALTER TABLE refresh_tokens
    ADD CONSTRAINT fk_refresh_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE;

-- Email verifications: pendiente sin usuario = ruido en la tabla.
ALTER TABLE email_verifications DROP CONSTRAINT IF EXISTS fk_email_verif_usuario;
ALTER TABLE email_verifications DROP CONSTRAINT IF EXISTS email_verifications_usuario_id_fkey;
ALTER TABLE email_verifications
    ADD CONSTRAINT fk_email_verif_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE;
