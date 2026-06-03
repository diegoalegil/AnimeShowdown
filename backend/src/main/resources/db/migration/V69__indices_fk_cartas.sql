-- ===========================================================================
-- V69__indices_fk_cartas.sql
-- Índices de cobertura para FKs ON DELETE CASCADE a `carta` que no estaban
-- indexadas. Postgres NO crea índice implícito para columnas FK (a diferencia
-- de PK/UNIQUE), así que sin estos índices:
--   * un DELETE de una fila de `carta` fuerza un sequential scan de las tablas
--     hijas para resolver el CASCADE,
--   * los JOIN/lookup inversos por carta (p.ej. cuántos usuarios poseen la
--     carta X, o limpiar trades de una carta) escanean la tabla entera.
-- usuario_carta es la tabla de mayor crecimiento (usuarios × cartas poseídas),
-- por lo que esto es clave de cara a escalar el catálogo a 5000-10000 cartas.
--
-- Nota de seguridad operativa: se usa CREATE INDEX (no CONCURRENTLY) a
-- propósito. CONCURRENTLY no puede ejecutarse dentro de la transacción que
-- Flyway abre por migración y NO lo soporta H2 (el motor del grueso del suite
-- de tests), así que rompería tanto la migración como los tests. A la escala
-- actual del producto las tablas son pequeñas y el bloqueo breve del build de
-- índice en el arranque es aceptable; si en el futuro estas tablas crecen a
-- millones de filas, migrar a CONCURRENTLY en una migración out-of-transaction
-- dedicada. IF NOT EXISTS mantiene la migración idempotente y portable.
--
-- NO se indexa carta.personaje_id: ya está cubierto por
-- uk_carta_personaje_rareza_variante UNIQUE (personaje_id, rareza, variante)
-- (V44), cuyo primer componente es personaje_id.
-- ===========================================================================

CREATE INDEX IF NOT EXISTS idx_usuario_carta_carta
    ON usuario_carta (carta_id);

CREATE INDEX IF NOT EXISTS idx_carta_trade_carta_ofrecida
    ON carta_trade (carta_ofrecida_id);

CREATE INDEX IF NOT EXISTS idx_carta_trade_carta_solicitada
    ON carta_trade (carta_solicitada_id);
