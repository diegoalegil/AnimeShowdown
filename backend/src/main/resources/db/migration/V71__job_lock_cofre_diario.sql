-- Lock del job de recordatorio del cofre diario (CofreDiarioAlertaJob).
-- Mismo patrón "claim atómico" que el resto de jobs (ver V67__job_lock.sql):
-- una sola instancia gana el slot diario y las demás lo saltan.
-- Append-only; portable H2/PG (INSERT plano, sin sintaxis específica de motor).
INSERT INTO job_lock (clave, ejecutado_en) VALUES ('cofre_diario_alerta', NULL);
