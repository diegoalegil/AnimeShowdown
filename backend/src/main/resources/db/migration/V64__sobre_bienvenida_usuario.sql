-- V64: sobre de bienvenida para nuevos usuarios.
-- NULL = no reclamado, NOT NULL = ya abierto (idempotente).
ALTER TABLE usuarios
    ADD COLUMN sobre_bienvenida_reclamado_en TIMESTAMP;
