-- Contador materializado del score visible por personaje.
-- Reduce lecturas calientes que antes reagrupaban toda la tabla votos para
-- pintar la coleccion de cartas. Los empates suman 0.5 a cada participante.

CREATE TABLE personaje_voto_score (
    personaje_id BIGINT PRIMARY KEY,
    votos_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_personaje_voto_score_personaje
        FOREIGN KEY (personaje_id) REFERENCES personajes(id) ON DELETE CASCADE,
    CONSTRAINT ck_personaje_voto_score_nonnegative CHECK (votos_score >= 0)
);

CREATE INDEX idx_personaje_voto_score_score
    ON personaje_voto_score (votos_score DESC, personaje_id ASC);

INSERT INTO personaje_voto_score (personaje_id, votos_score, actualizado_en)
SELECT p.id,
       COALESCE(SUM(materializado.score), 0),
       CURRENT_TIMESTAMP
FROM personajes p
LEFT JOIN (
    SELECT v.personaje_id AS personaje_id,
           CAST(1.0 AS DOUBLE PRECISION) AS score
    FROM votos v
    WHERE v.empate = FALSE
      AND v.personaje_id IS NOT NULL

    UNION ALL

    SELECT e.personaje1_id AS personaje_id,
           CAST(0.5 AS DOUBLE PRECISION) AS score
    FROM votos v
    JOIN enfrentamientos e ON e.id = v.enfrentamiento_id
    WHERE v.empate = TRUE
      AND e.personaje1_id IS NOT NULL

    UNION ALL

    SELECT e.personaje2_id AS personaje_id,
           CAST(0.5 AS DOUBLE PRECISION) AS score
    FROM votos v
    JOIN enfrentamientos e ON e.id = v.enfrentamiento_id
    WHERE v.empate = TRUE
      AND e.personaje2_id IS NOT NULL
) materializado ON materializado.personaje_id = p.id
GROUP BY p.id;
