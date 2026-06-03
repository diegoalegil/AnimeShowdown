-- Lock de ejecución de jobs @Scheduled para despliegues MULTI-INSTANCIA.
--
-- Patrón "claim atómico" (ShedLock-lite): cada job intenta marcar ejecutado_en
-- con un UPDATE condicionado a un TTL; el row-lock del UPDATE serializa a las
-- instancias que disparan el job a la vez, así que solo UNA gana el slot
-- (rowcount 1) y las demás lo ven ya reclamado (rowcount 0) y saltan. Evita
-- trabajo duplicado al escalar horizontalmente: doble materialización del pool
-- de la Arena (reponer 2x) y notificaciones de favorito duplicadas.
--
-- Hoy el deploy es mono-instancia, así que esto es defensa a futuro sin coste.
-- TIMESTAMP plano (sin zona): el umbral se calcula en Java (cross-DB H2/PG),
-- no con INTERVAL/now() específicos del motor.
CREATE TABLE job_lock (
    clave         VARCHAR(64) PRIMARY KEY,
    ejecutado_en  TIMESTAMP
);

INSERT INTO job_lock (clave, ejecutado_en) VALUES
    ('arena_mantener', NULL),
    ('alerta_favorito', NULL);
