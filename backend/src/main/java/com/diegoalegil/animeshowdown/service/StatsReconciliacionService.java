package com.diegoalegil.animeshowdown.service;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reconcilia las stats materializadas que dirigen el ranking contra la fuente de
 * verdad (la tabla {@code votos}).
 *
 * <p>Esas stats se mantienen incrementalmente por listeners {@code AFTER_COMMIT}
 * {@code @Async} best-effort: si un evento async se pierde (excepción, reinicio
 * en el momento malo), el valor materializado queda por debajo del real y NADA
 * lo corregía → el ranking driftaba. Este servicio recomputa el agregado
 * autoritativo (la misma fórmula de los backfills V49/V53), lo compara con lo
 * materializado y corrige SOLO las filas drifteadas (así detecta además cuánto
 * drift hay, señal de eventos perdidos).
 *
 * <p>Cubre las dos tablas que mueven ranking y colección: {@code voto_personaje_stats}
 * (score + peso) y {@code personaje_voto_score} (score visible de cartas). Es
 * convergente: cada corrida deja la materialización = función de {@code votos},
 * de modo que cualquier error transitorio por carrera con un voto concurrente se
 * autocorrige en la siguiente.
 */
@Service
public class StatsReconciliacionService {

    private static final Logger log = LoggerFactory.getLogger(StatsReconciliacionService.class);
    private static final double EPS = 1e-6;

    // Agregado autoritativo de voto_personaje_stats (= SELECT del backfill V49):
    // empate suma 0.50 a cada participante, voto normal 1.00 al elegido; peso = v.peso.
    private static final String AGG_PERSONAJE_STATS = """
            SELECT personaje_id, SUM(votos_score) AS score, SUM(peso_votos) AS peso
            FROM (
                SELECT
                    CASE WHEN v.empate = TRUE THEN e.personaje1_id ELSE v.personaje_id END AS personaje_id,
                    CASE WHEN v.empate = TRUE THEN 0.50 ELSE 1.00 END AS votos_score,
                    v.peso AS peso_votos
                FROM votos v
                LEFT JOIN enfrentamientos e ON e.id = v.enfrentamiento_id
                WHERE (v.empate = FALSE AND v.personaje_id IS NOT NULL)
                   OR (v.empate = TRUE AND e.personaje1_id IS NOT NULL)
                UNION ALL
                SELECT e.personaje2_id, 0.50, v.peso
                FROM votos v
                JOIN enfrentamientos e ON e.id = v.enfrentamiento_id
                WHERE v.empate = TRUE AND e.personaje2_id IS NOT NULL
            ) stats
            WHERE personaje_id IS NOT NULL
            GROUP BY personaje_id
            """;

    // Agregado autoritativo de personaje_voto_score (= SELECT del backfill V53).
    private static final String AGG_PERSONAJE_SCORE = """
            SELECT personaje_id, SUM(score) AS score
            FROM (
                SELECT v.personaje_id AS personaje_id, CAST(1.0 AS DOUBLE PRECISION) AS score
                FROM votos v WHERE v.empate = FALSE AND v.personaje_id IS NOT NULL
                UNION ALL
                SELECT e.personaje1_id, CAST(0.5 AS DOUBLE PRECISION)
                FROM votos v JOIN enfrentamientos e ON e.id = v.enfrentamiento_id
                WHERE v.empate = TRUE AND e.personaje1_id IS NOT NULL
                UNION ALL
                SELECT e.personaje2_id, CAST(0.5 AS DOUBLE PRECISION)
                FROM votos v JOIN enfrentamientos e ON e.id = v.enfrentamiento_id
                WHERE v.empate = TRUE AND e.personaje2_id IS NOT NULL
            ) m
            WHERE personaje_id IS NOT NULL
            GROUP BY personaje_id
            """;

    private final JdbcTemplate jdbcTemplate;

    public StatsReconciliacionService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** Filas corregidas por tabla en una reconciliación. */
    public record Resultado(int driftPersonajeStats, int driftPersonajeScore) {
        public int total() {
            return driftPersonajeStats + driftPersonajeScore;
        }
    }

    @Transactional
    public Resultado reconciliar() {
        int d1 = reconciliarPersonajeStats();
        int d2 = reconciliarPersonajeScore();
        Resultado r = new Resultado(d1, d2);
        if (r.total() > 0) {
            log.warn("Reconciliación de stats: drift corregido — voto_personaje_stats={}, "
                    + "personaje_voto_score={} (indicio de eventos async perdidos)", d1, d2);
        } else {
            log.info("Reconciliación de stats: sin drift, materialización consistente con votos");
        }
        return r;
    }

    private int reconciliarPersonajeStats() {
        Map<Long, BigDecimal[]> auth = new HashMap<>();
        jdbcTemplate.query(AGG_PERSONAJE_STATS, rs -> {
            auth.put(rs.getLong("personaje_id"),
                    new BigDecimal[]{ rs.getBigDecimal("score"), rs.getBigDecimal("peso") });
        });

        Map<Long, BigDecimal[]> actual = new HashMap<>();
        jdbcTemplate.query("SELECT personaje_id, votos_score, peso_votos FROM voto_personaje_stats", rs -> {
            actual.put(rs.getLong(1), new BigDecimal[]{ rs.getBigDecimal(2), rs.getBigDecimal(3) });
        });

        int drift = 0;
        for (Map.Entry<Long, BigDecimal[]> e : auth.entrySet()) {
            Long pid = e.getKey();
            BigDecimal score = e.getValue()[0];
            BigDecimal peso = e.getValue()[1];
            BigDecimal[] cur = actual.get(pid);
            if (cur == null) {
                jdbcTemplate.update("""
                        INSERT INTO voto_personaje_stats (personaje_id, votos_score, peso_votos, updated_at)
                        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                        """, pid, score, peso);
                drift++;
            } else if (cur[0].compareTo(score) != 0 || cur[1].compareTo(peso) != 0) {
                jdbcTemplate.update("""
                        UPDATE voto_personaje_stats
                        SET votos_score = ?, peso_votos = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE personaje_id = ?
                        """, score, peso, pid);
                drift++;
            }
        }
        return drift;
    }

    private int reconciliarPersonajeScore() {
        Map<Long, Double> auth = new HashMap<>();
        jdbcTemplate.query(AGG_PERSONAJE_SCORE, rs -> {
            auth.put(rs.getLong("personaje_id"), rs.getDouble("score"));
        });

        Map<Long, Double> actual = new HashMap<>();
        jdbcTemplate.query("SELECT personaje_id, votos_score FROM personaje_voto_score", rs -> {
            actual.put(rs.getLong(1), rs.getDouble(2));
        });

        int drift = 0;
        for (Map.Entry<Long, Double> e : auth.entrySet()) {
            Long pid = e.getKey();
            double score = e.getValue();
            Double cur = actual.get(pid);
            if (cur == null) {
                // Personaje con votos pero sin fila materializada (evento de
                // creación perdido). Sembramos idempotente y fijamos el valor.
                jdbcTemplate.update(
                        "INSERT INTO personaje_voto_score (personaje_id, votos_score, actualizado_en) "
                        + "VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING", pid, score);
                jdbcTemplate.update(
                        "UPDATE personaje_voto_score SET votos_score = ?, actualizado_en = CURRENT_TIMESTAMP "
                        + "WHERE personaje_id = ?", score, pid);
                drift++;
            } else if (Math.abs(cur - score) > EPS) {
                jdbcTemplate.update(
                        "UPDATE personaje_voto_score SET votos_score = ?, actualizado_en = CURRENT_TIMESTAMP "
                        + "WHERE personaje_id = ?", score, pid);
                drift++;
            }
        }
        return drift;
    }
}
