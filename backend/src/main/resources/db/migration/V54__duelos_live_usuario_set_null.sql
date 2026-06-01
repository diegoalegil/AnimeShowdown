-- Permite borrar cuentas conservando el historial PvP.
-- V48 se usa para personaje_voto_score.

ALTER TABLE duelos_live DROP CONSTRAINT IF EXISTS fk_duelos_live_jugador1;
ALTER TABLE duelos_live DROP CONSTRAINT IF EXISTS fk_duelos_live_jugador2;
ALTER TABLE duelos_live DROP CONSTRAINT IF EXISTS fk_duelos_live_ganador;
ALTER TABLE duelos_live DROP CONSTRAINT IF EXISTS fk_duelos_live_abandonador;

ALTER TABLE duelos_live ALTER COLUMN jugador1_id DROP NOT NULL;

ALTER TABLE duelos_live
    ADD CONSTRAINT fk_duelos_live_jugador1
    FOREIGN KEY (jugador1_id) REFERENCES usuarios (id) ON DELETE SET NULL;

ALTER TABLE duelos_live
    ADD CONSTRAINT fk_duelos_live_jugador2
    FOREIGN KEY (jugador2_id) REFERENCES usuarios (id) ON DELETE SET NULL;

ALTER TABLE duelos_live
    ADD CONSTRAINT fk_duelos_live_ganador
    FOREIGN KEY (ganador_id) REFERENCES usuarios (id) ON DELETE SET NULL;

ALTER TABLE duelos_live
    ADD CONSTRAINT fk_duelos_live_abandonador
    FOREIGN KEY (abandonador_id) REFERENCES usuarios (id) ON DELETE SET NULL;
