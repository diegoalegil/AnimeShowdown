-- V77: claves foráneas para las tablas-ledger de recompensas de evento (A15).
-- evento_recompensa_entregada y sobre_gratis_credito (V65) se crearon sin FK a
-- usuarios/torneos: al borrar una cuenta (o un torneo) las filas quedaban
-- huérfanas para siempre (integridad + GDPR). Se añaden FK con ON DELETE CASCADE
-- para que el borrado de cuenta arrastre el ledger, consistente con el resto de
-- tablas por-usuario (ver V13/V19/V40).

-- Limpieza previa: ADD CONSTRAINT falla si ya hay filas huérfanas (justo el
-- bug que arreglamos). El UNIQUE (torneo_id, usuario_id) cubre el cascade por
-- torneo; el índice idx_evento_recompensa_usuario cubre el cascade por usuario.
DELETE FROM evento_recompensa_entregada
 WHERE usuario_id NOT IN (SELECT id FROM usuarios)
    OR torneo_id NOT IN (SELECT id FROM torneos);

DELETE FROM sobre_gratis_credito
 WHERE usuario_id NOT IN (SELECT id FROM usuarios);

ALTER TABLE evento_recompensa_entregada
    ADD CONSTRAINT fk_evento_recompensa_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE;

ALTER TABLE evento_recompensa_entregada
    ADD CONSTRAINT fk_evento_recompensa_torneo
        FOREIGN KEY (torneo_id) REFERENCES torneos (id) ON DELETE CASCADE;

ALTER TABLE sobre_gratis_credito
    ADD CONSTRAINT fk_sobre_gratis_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE;
