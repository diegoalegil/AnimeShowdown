-- Plan producto (2026-05-18): "Mi roster / Favoritos".
--
-- Relación N:M usuario → personaje. PK compuesta para imponer unicidad
-- (no se puede seguir dos veces al mismo personaje) sin necesidad de
-- un constraint adicional. ON DELETE CASCADE en ambos lados — si el
-- usuario se borra (GDPR right to erasure) o un personaje se retira
-- del catálogo, sus filas de favorito desaparecen sin restos huérfanos.

CREATE TABLE personajes_favoritos (
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    personaje_id BIGINT NOT NULL REFERENCES personajes(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, personaje_id)
);

-- Búsquedas inversas:
--   GET /api/me/favoritos → filtra por usuario_id, ordena por created_at
--     DESC. El idx_usuario_created cubre ambos.
--   Conteo de cuántos siguen a un personaje (futuro "X fans") → filtra
--     por personaje_id; idx separado para no acoplar la query.
CREATE INDEX idx_personajes_favoritos_usuario_created
    ON personajes_favoritos(usuario_id, created_at DESC);

CREATE INDEX idx_personajes_favoritos_personaje
    ON personajes_favoritos(personaje_id);
