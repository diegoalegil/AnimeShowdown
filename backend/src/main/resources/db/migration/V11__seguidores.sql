-- ===========================================================================
-- V11__seguidores.sql
-- Plan v2 §4.5 — Sistema de friends / follow.
--
-- Modelo asimétrico (como Twitter, no Facebook): A puede seguir a B sin
-- que B siga a A. Para "amigos mutuos" se calcula en query (INTERSECT).
--
-- PK compuesta (seguidor_id, seguido_id) garantiza que no haya duplicados
-- — un usuario solo puede seguir a otro una vez. Para "dejar de seguir"
-- el service hace DELETE.
--
-- CHECK seguidor != seguido evita la patología de auto-follow. Postgres
-- y H2 (MODE=PostgreSQL) lo respetan idénticamente.
-- ===========================================================================

CREATE TABLE seguidores (
    seguidor_id    BIGINT     NOT NULL,
    seguido_id     BIGINT     NOT NULL,
    fecha_inicio   TIMESTAMP  NOT NULL,
    PRIMARY KEY (seguidor_id, seguido_id),
    CONSTRAINT fk_seguidor_usuario
        FOREIGN KEY (seguidor_id) REFERENCES usuarios (id) ON DELETE CASCADE,
    CONSTRAINT fk_seguido_usuario
        FOREIGN KEY (seguido_id) REFERENCES usuarios (id) ON DELETE CASCADE,
    CONSTRAINT ck_seguidor_distinto_seguido
        CHECK (seguidor_id <> seguido_id)
);

-- Indices para las queries hot path: "quién sigue a X" y "a quién sigue X".
-- La PK (seguidor_id, seguido_id) cubre la segunda; añadimos un index
-- invertido para la primera ("¿cuántos seguidores tengo?").
CREATE INDEX idx_seguidores_seguido ON seguidores (seguido_id);
