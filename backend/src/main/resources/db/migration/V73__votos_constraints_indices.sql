-- DATA-01: V16 dropeaba uk_voto_personaje_usuario por nombre literal. En una
-- BBDD baselined el unique (personaje_id, usuario_id) nace con el nombre
-- autogenerado de Postgres (votos_personaje_id_usuario_id_key), así que el
-- DROP fue no-op y el unique global puede seguir vivo: el segundo voto al
-- mismo personaje en otra ronda revienta con 500. Se dropea aquí cualquier
-- unique sobre exactamente (personaje_id, usuario_id), tenga el nombre que
-- tenga. uk_voto_enfrentamiento_usuario (el que sí queremos) no matchea.
DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'votos'::regclass
          AND contype = 'u'
          AND (
            SELECT array_agg(attname ORDER BY attname)
            FROM unnest(conkey) AS k(attnum)
            JOIN pg_attribute a ON a.attrelid = conrelid AND a.attnum = k.attnum
          ) = ARRAY['personaje_id', 'usuario_id']::name[]
    LOOP
        EXECUTE format('ALTER TABLE votos DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;

-- DATA-12: countByUsuario corre en cada voto autenticado y el ON DELETE SET
-- NULL del borrado de cuenta hacía full-scan sin este índice.
CREATE INDEX IF NOT EXISTS idx_votos_usuario ON votos (usuario_id);

-- DATA-13: los votos anónimos pre-V28 quedaron con el DEFAULT 1.00 y pesaban
-- 3.3x más que los anónimos actuales (0.30, ver EnfrentamientoController
-- ANON_VOTE_WEIGHT). Si no existen filas así, es un no-op.
UPDATE votos SET peso = 0.30 WHERE usuario_id IS NULL AND peso = 1.00;
