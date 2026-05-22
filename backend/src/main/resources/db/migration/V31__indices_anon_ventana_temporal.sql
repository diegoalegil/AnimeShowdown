-- Audit externo AS-004 (2026-05-23): el throttle antifraude del voto
-- anónimo cuenta votos en ventanas 1h/24h por (anon_session_id, fecha)
-- y (anon_ip_hash, fecha). Los índices simples de V28
-- (idx_votos_anon_session, idx_votos_anon_ip_hash) más
-- idx_votos_fecha (V18) ya permiten ejecutar la query, pero el planner
-- decide entre ambos sin tener uno compuesto óptimo — en tablas con
-- millones de votos eso se traduce en scans más caros.
--
-- Índices compuestos cubren exactamente las queries de
-- AnonymousAbuseThrottleService:
--   countByAnonSessionIdAndFechaAfter(sessionId, desde)
--   countByAnonIpHashAndFechaAfter(hash, desde)
--
-- Sin WHERE parcial: H2 (tests) no soporta partial indexes en
-- CREATE INDEX. Las filas con NULL en anon_session_id (votos
-- registrados) ocupan espacio extra en el índice pero el coste es
-- despreciable y mantiene portabilidad entre motores.
CREATE INDEX IF NOT EXISTS idx_votos_anon_session_fecha
    ON votos (anon_session_id, fecha);

CREATE INDEX IF NOT EXISTS idx_votos_anon_ip_hash_fecha
    ON votos (anon_ip_hash, fecha);
