-- V66: Arena permanente.
-- Un torneo-sistema sin bracket (es_arena = true, IN_PROGRESS, no público) cuyo
-- pool de enfrentamientos del roster se vota como cualquier match → los votos
-- cuentan para el ranking. Da voto infinito sin repetición (pool grande,
-- emparejado por ELO, los duelos maduros se resuelven y se reponen en background).
-- El auto-avance de torneos IGNORA la Arena (no hay rondas que cerrar).
ALTER TABLE torneos ADD COLUMN es_arena BOOLEAN NOT NULL DEFAULT FALSE;
