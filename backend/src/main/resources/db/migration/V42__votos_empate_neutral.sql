-- ===========================================================================
-- V42__votos_empate_neutral.sql
-- "No puedo decidir": voto neutral.
--
-- Un voto neutral sigue siendo UNA acción de voto por enfrentamiento/votante,
-- así que NO tocamos las constraints únicas existentes. La fila se marca con
-- empate=TRUE y el backend la reparte en agregados como 0.5 para cada
-- personaje del enfrentamiento. Los votos históricos quedan empate=FALSE.
--
-- Portable Postgres + H2 (MODE=PostgreSQL para tests).
-- ===========================================================================

ALTER TABLE votos
    ADD COLUMN empate BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_votos_empate ON votos (empate);
