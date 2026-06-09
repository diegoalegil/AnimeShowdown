-- DATA-01: V16 dropeaba uk_voto_personaje_usuario por nombre literal. En una
-- BBDD baselined el unique (personaje_id, usuario_id) nace con el nombre
-- autogenerado de Postgres (votos_personaje_id_usuario_id_key), así que aquel
-- DROP pudo ser no-op y el unique global seguir vivo: el segundo voto al
-- mismo personaje en otra ronda revienta con 500. Se dropean los DOS nombres
-- posibles (el explícito de V1 y el autogenerado de Postgres). SQL plano e
-- IF EXISTS por portabilidad Postgres/H2 (tests), igual que V16.
ALTER TABLE votos DROP CONSTRAINT IF EXISTS uk_voto_personaje_usuario;
ALTER TABLE votos DROP CONSTRAINT IF EXISTS votos_personaje_id_usuario_id_key;

-- DATA-12: countByUsuario corre en cada voto autenticado y el ON DELETE SET
-- NULL del borrado de cuenta hacía full-scan sin este índice.
CREATE INDEX IF NOT EXISTS idx_votos_usuario ON votos (usuario_id);

-- DATA-13: los votos anónimos pre-V28 quedaron con el DEFAULT 1.00 y pesaban
-- 3.3x más que los anónimos actuales (0.30, ver EnfrentamientoController
-- ANON_VOTE_WEIGHT). Si no existen filas así, es un no-op.
UPDATE votos SET peso = 0.30 WHERE usuario_id IS NULL AND peso = 1.00;
