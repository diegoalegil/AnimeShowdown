-- Stats materializadas para rankings y hot path de votos.
-- V48 queda reservado para indices de Duelo Live; esta migracion empieza en V49
-- para mantener la secuencia global de cambios.
-- Portable Postgres + H2 (MODE=PostgreSQL para tests): sin indices parciales.

CREATE TABLE IF NOT EXISTS voto_personaje_stats (
    personaje_id BIGINT PRIMARY KEY,
    votos_score NUMERIC(12, 2) NOT NULL DEFAULT 0,
    peso_votos NUMERIC(12, 2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_voto_personaje_stats_personaje
        FOREIGN KEY (personaje_id) REFERENCES personajes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_voto_personaje_stats_ranking
    ON voto_personaje_stats (peso_votos DESC, personaje_id ASC);

CREATE TABLE IF NOT EXISTS voto_personaje_dia_stats (
    personaje_id BIGINT NOT NULL,
    dia DATE NOT NULL,
    votos_score NUMERIC(12, 2) NOT NULL DEFAULT 0,
    peso_votos NUMERIC(12, 2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (personaje_id, dia),
    CONSTRAINT fk_voto_personaje_dia_stats_personaje
        FOREIGN KEY (personaje_id) REFERENCES personajes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_voto_personaje_dia_stats_ranking
    ON voto_personaje_dia_stats (dia, peso_votos DESC, personaje_id ASC);

CREATE TABLE IF NOT EXISTS voto_enfrentamiento_stats (
    enfrentamiento_id BIGINT NOT NULL,
    personaje_id BIGINT NOT NULL,
    votos_score NUMERIC(12, 2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (enfrentamiento_id, personaje_id),
    CONSTRAINT fk_voto_enfrentamiento_stats_enfrentamiento
        FOREIGN KEY (enfrentamiento_id) REFERENCES enfrentamientos(id) ON DELETE CASCADE,
    CONSTRAINT fk_voto_enfrentamiento_stats_personaje
        FOREIGN KEY (personaje_id) REFERENCES personajes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_voto_enfrentamiento_stats_personaje
    ON voto_enfrentamiento_stats (personaje_id, enfrentamiento_id);

CREATE TABLE IF NOT EXISTS voto_torneo_stats (
    torneo_id BIGINT PRIMARY KEY,
    votos_total BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_voto_torneo_stats_torneo
        FOREIGN KEY (torneo_id) REFERENCES torneos(id) ON DELETE CASCADE
);

INSERT INTO voto_personaje_stats (personaje_id, votos_score, peso_votos, updated_at)
SELECT personaje_id, SUM(votos_score), SUM(peso_votos), CURRENT_TIMESTAMP
FROM (
    SELECT
        CASE
            WHEN v.empate = TRUE THEN e.personaje1_id
            ELSE v.personaje_id
        END AS personaje_id,
        CASE
            WHEN v.empate = TRUE THEN 0.50
            ELSE 1.00
        END AS votos_score,
        v.peso AS peso_votos
    FROM votos v
    LEFT JOIN enfrentamientos e ON e.id = v.enfrentamiento_id
    WHERE (v.empate = FALSE AND v.personaje_id IS NOT NULL)
       OR (v.empate = TRUE AND e.personaje1_id IS NOT NULL)

    UNION ALL

    SELECT
        e.personaje2_id AS personaje_id,
        0.50 AS votos_score,
        v.peso AS peso_votos
    FROM votos v
    JOIN enfrentamientos e ON e.id = v.enfrentamiento_id
    WHERE v.empate = TRUE
      AND e.personaje2_id IS NOT NULL
) stats
WHERE personaje_id IS NOT NULL
GROUP BY personaje_id;

INSERT INTO voto_personaje_dia_stats (personaje_id, dia, votos_score, peso_votos, updated_at)
SELECT personaje_id, dia, SUM(votos_score), SUM(peso_votos), CURRENT_TIMESTAMP
FROM (
    SELECT
        CASE
            WHEN v.empate = TRUE THEN e.personaje1_id
            ELSE v.personaje_id
        END AS personaje_id,
        CAST(v.fecha AS DATE) AS dia,
        CASE
            WHEN v.empate = TRUE THEN 0.50
            ELSE 1.00
        END AS votos_score,
        v.peso AS peso_votos
    FROM votos v
    LEFT JOIN enfrentamientos e ON e.id = v.enfrentamiento_id
    WHERE v.fecha IS NOT NULL
      AND (
          (v.empate = FALSE AND v.personaje_id IS NOT NULL)
          OR (v.empate = TRUE AND e.personaje1_id IS NOT NULL)
      )

    UNION ALL

    SELECT
        e.personaje2_id AS personaje_id,
        CAST(v.fecha AS DATE) AS dia,
        0.50 AS votos_score,
        v.peso AS peso_votos
    FROM votos v
    JOIN enfrentamientos e ON e.id = v.enfrentamiento_id
    WHERE v.empate = TRUE
      AND v.fecha IS NOT NULL
      AND e.personaje2_id IS NOT NULL
) stats
WHERE personaje_id IS NOT NULL
  AND dia IS NOT NULL
GROUP BY personaje_id, dia;

INSERT INTO voto_enfrentamiento_stats (enfrentamiento_id, personaje_id, votos_score, updated_at)
SELECT enfrentamiento_id, personaje_id, SUM(votos_score), CURRENT_TIMESTAMP
FROM (
    SELECT
        v.enfrentamiento_id AS enfrentamiento_id,
        CASE
            WHEN v.empate = TRUE THEN e.personaje1_id
            ELSE v.personaje_id
        END AS personaje_id,
        CASE
            WHEN v.empate = TRUE THEN 0.50
            ELSE 1.00
        END AS votos_score
    FROM votos v
    LEFT JOIN enfrentamientos e ON e.id = v.enfrentamiento_id
    WHERE v.enfrentamiento_id IS NOT NULL
      AND (
          (v.empate = FALSE AND v.personaje_id IS NOT NULL)
          OR (v.empate = TRUE AND e.personaje1_id IS NOT NULL)
      )

    UNION ALL

    SELECT
        v.enfrentamiento_id AS enfrentamiento_id,
        e.personaje2_id AS personaje_id,
        0.50 AS votos_score
    FROM votos v
    JOIN enfrentamientos e ON e.id = v.enfrentamiento_id
    WHERE v.empate = TRUE
      AND v.enfrentamiento_id IS NOT NULL
      AND e.personaje2_id IS NOT NULL
) stats
WHERE enfrentamiento_id IS NOT NULL
  AND personaje_id IS NOT NULL
GROUP BY enfrentamiento_id, personaje_id;

INSERT INTO voto_torneo_stats (torneo_id, votos_total, updated_at)
SELECT e.torneo_id, COUNT(v.id), CURRENT_TIMESTAMP
FROM votos v
JOIN enfrentamientos e ON e.id = v.enfrentamiento_id
WHERE e.torneo_id IS NOT NULL
GROUP BY e.torneo_id;
