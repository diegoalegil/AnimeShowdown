-- Idempotencia de fan-out: una notificación de torneo por usuario/tipo/evento.
-- evento_key queda NULL para notificaciones no event-driven, así que no altera
-- flujos como follow/unfollow, logros o avisos genéricos.

DELETE FROM notificaciones
WHERE payload IS NOT NULL
  AND tipo IN ('TORNEO_INICIADO', 'TORNEO_FINALIZADO')
  AND id NOT IN (
      SELECT MIN(id)
      FROM notificaciones
      WHERE payload IS NOT NULL
        AND tipo IN ('TORNEO_INICIADO', 'TORNEO_FINALIZADO')
      GROUP BY usuario_id, tipo, payload
  );

ALTER TABLE notificaciones
    ADD COLUMN evento_key VARCHAR(768);

UPDATE notificaciones
SET evento_key = payload
WHERE payload IS NOT NULL
  AND tipo IN ('TORNEO_INICIADO', 'TORNEO_FINALIZADO');

CREATE UNIQUE INDEX uk_notif_usuario_tipo_evento
    ON notificaciones (usuario_id, tipo, evento_key);
