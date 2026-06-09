package com.diegoalegil.animeshowdown.service;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.PersonajeScoreItem;

@Service
public class PersonajeScoreQueryService {

    private static final int LIMITE_MAXIMO = 5000;

    private final JdbcTemplate jdbcTemplate;

    public PersonajeScoreQueryService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Pool compacto para superficies competitivas. El total sale de
     * voto_personaje_stats (materializado) y la recencia conserva precisión de
     * timestamp leyendo solo la ventana reciente, apoyada por idx_votos_fecha.
     */
    @Transactional(readOnly = true)
    public List<PersonajeScoreItem> topConPuntuacionYRecencia(LocalDateTime desde, int limit) {
        Timestamp desdeSql = Timestamp.valueOf(desde);
        return jdbcTemplate.query("""
                SELECT p.id,
                       p.slug,
                       p.nombre,
                       p.anime,
                       p.imagen_url,
                       p.imagen_color_dominante,
                       p.elo_semilla,
                       COALESCE(s.votos_score, 0) AS votos_totales,
                       COALESCE(r.votos_recientes, 0) AS votos_recientes
                FROM personajes p
                LEFT JOIN voto_personaje_stats s ON s.personaje_id = p.id
                LEFT JOIN (
                    SELECT personaje_id, SUM(votos_score) AS votos_recientes
                    FROM (
                        SELECT
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
                        WHERE v.fecha >= ?
                          AND (
                              (v.empate = FALSE AND v.personaje_id IS NOT NULL)
                              OR (v.empate = TRUE AND e.personaje1_id IS NOT NULL)
                          )

                        UNION ALL

                        SELECT
                            e.personaje2_id AS personaje_id,
                            0.50 AS votos_score
                        FROM votos v
                        JOIN enfrentamientos e ON e.id = v.enfrentamiento_id
                        WHERE v.fecha >= ?
                          AND v.empate = TRUE
                          AND e.personaje2_id IS NOT NULL
                    ) recientes_raw
                    WHERE personaje_id IS NOT NULL
                    GROUP BY personaje_id
                ) r ON r.personaje_id = p.id
                ORDER BY COALESCE(s.votos_score, 0) DESC, p.id ASC
                LIMIT ?
                """, (rs, rowNum) -> new PersonajeScoreItem(
                        rs.getLong("id"),
                        rs.getString("slug"),
                        rs.getString("nombre"),
                        rs.getString("anime"),
                        rs.getString("imagen_url"),
                        rs.getString("imagen_color_dominante"),
                        nullableInt(rs.getObject("elo_semilla")),
                        rs.getDouble("votos_totales"),
                        rs.getDouble("votos_recientes")),
                desdeSql,
                desdeSql,
                saneLimit(limit));
    }

    private int saneLimit(int limit) {
        return Math.max(1, Math.min(LIMITE_MAXIMO, limit));
    }

    private static Integer nullableInt(Object value) {
        return value == null ? null : ((Number) value).intValue();
    }
}
