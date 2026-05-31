-- Historial de perfil:
-- VotoRepository.findByUsuarioOrderByFechaDesc filtra por usuario_id y ordena
-- por fecha. El indice compuesto cubre ambas partes de la query en Postgres y
-- sigue siendo portable en H2 para tests.
CREATE INDEX IF NOT EXISTS idx_votos_usuario_fecha ON votos (usuario_id, fecha);
