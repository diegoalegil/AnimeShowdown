package com.diegoalegil.animeshowdown.service;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Voto;

@Service
public class VotoStatsService {

    private static final BigDecimal VOTO_NORMAL = new BigDecimal("1.00");
    private static final BigDecimal MEDIO_VOTO = new BigDecimal("0.50");
    private static final PersonajeStats ZERO_STATS = new PersonajeStats(null, 0.0, 0.0);

    private final JdbcTemplate jdbcTemplate;

    public VotoStatsService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public VotoStatsSnapshot registrar(Voto voto) {
        List<PersonajeDelta> deltas = deltasDe(voto);
        Enfrentamiento enfrentamiento = voto.getEnfrentamiento();

        // Solo lo que alimenta la respuesta del POST (score por-match → DTO) y
        // el delta de ranking en vivo (totales all-time del personaje → WS).
        // Las agregaciones diaria/por-torneo se materializan async (ver
        // registrarAgregadosDiarios) porque solo las leen rankings por ventana
        // cacheados, no el hot path del voto.
        for (PersonajeDelta delta : deltas) {
            upsertPersonaje(delta.personaje().getId(), delta.votosScore(), delta.pesoVotos());
            if (enfrentamiento != null && enfrentamiento.getId() != null) {
                upsertEnfrentamiento(enfrentamiento.getId(), delta.personaje().getId(), delta.votosScore());
            }
        }

        return snapshot(enfrentamiento, deltas);
    }

    /**
     * Materializa las agregaciones diaria ({@code voto_personaje_dia_stats}) y
     * por-torneo ({@code voto_torneo_stats}) FUERA de la transacción del POST.
     * La invoca {@code VotoAgregadoStatsListener} en AFTER_COMMIT @Async: estas
     * tablas solo las leen rankings por ventana (cacheados), nunca el DTO del
     * voto ni el delta WS, así que aceptan consistencia eventual de unos ms.
     */
    @Transactional
    public void registrarAgregadosDiarios(
            List<com.diegoalegil.animeshowdown.event.VotoAgregadoEvent.DiaDelta> deltas,
            LocalDate dia,
            Long torneoId) {
        for (var delta : deltas) {
            upsertPersonajeDia(delta.personajeId(), dia, delta.votosScore(), delta.pesoVotos());
        }
        if (torneoId != null) {
            upsertTorneo(torneoId);
        }
    }

    @Transactional(readOnly = true)
    public VotoStatsSnapshot snapshot(Enfrentamiento enfrentamiento, List<PersonajeDelta> deltas) {
        Map<Long, Double> scores = scoresPorPersonaje(enfrentamiento);
        Map<Long, PersonajeStats> stats = deltas.stream()
                .map(PersonajeDelta::personaje)
                .filter(p -> p != null && p.getId() != null)
                .collect(Collectors.toMap(
                        Personaje::getId,
                        p -> statsPersonaje(p.getId()),
                        (a, b) -> a));
        return new VotoStatsSnapshot(scores, stats, List.copyOf(deltas));
    }

    private List<PersonajeDelta> deltasDe(Voto voto) {
        BigDecimal peso = voto.getPeso() == null ? VOTO_NORMAL : voto.getPeso();
        if (voto.isEmpate()) {
            Enfrentamiento enf = voto.getEnfrentamiento();
            List<PersonajeDelta> deltas = new ArrayList<>(2);
            if (enf != null && enf.getPersonaje1() != null) {
                deltas.add(new PersonajeDelta(enf.getPersonaje1(), MEDIO_VOTO, peso));
            }
            if (enf != null && enf.getPersonaje2() != null) {
                deltas.add(new PersonajeDelta(enf.getPersonaje2(), MEDIO_VOTO, peso));
            }
            return deltas;
        }
        Personaje personaje = voto.getPersonaje();
        if (personaje == null || personaje.getId() == null) {
            return List.of();
        }
        return List.of(new PersonajeDelta(personaje, VOTO_NORMAL, peso));
    }

    // Upsert atómico idempotente (mismo patrón que CartaService.registrarPosesion):
    // incrementa; si la fila no existe, inserta con INSERT ... ON CONFLICT DO NOTHING;
    // si una votación concurrente la creó primero (0 filas insertadas), incrementa de
    // nuevo. Antes el patrón era UPDATE -> INSERT plano -> catch(DuplicateKey) ->
    // RECURSIÓN: en Postgres la violación de la PK del INSERT ABORTA toda la tx
    // ("current transaction is aborted"), así que el UPDATE de la recursión fallaba
    // -> el voto reventaba en la carrera de la primera fila (H2 no aborta la tx
    // entera, por eso los tests pasaban). El ON CONFLICT DO NOTHING nunca lanza.

    private void upsertPersonaje(Long personajeId, BigDecimal scoreDelta, BigDecimal pesoDelta) {
        if (incrementaPersonaje(personajeId, scoreDelta, pesoDelta) > 0) return;
        int insertadas = jdbcTemplate.update("""
                INSERT INTO voto_personaje_stats
                    (personaje_id, votos_score, peso_votos, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT DO NOTHING
                """, personajeId, scoreDelta, pesoDelta);
        if (insertadas == 0) {
            incrementaPersonaje(personajeId, scoreDelta, pesoDelta);
        }
    }

    private int incrementaPersonaje(Long personajeId, BigDecimal scoreDelta, BigDecimal pesoDelta) {
        return jdbcTemplate.update("""
                UPDATE voto_personaje_stats
                SET votos_score = votos_score + ?,
                    peso_votos = peso_votos + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE personaje_id = ?
                """, scoreDelta, pesoDelta, personajeId);
    }

    private void upsertPersonajeDia(Long personajeId, LocalDate dia, BigDecimal scoreDelta, BigDecimal pesoDelta) {
        Date sqlDia = Date.valueOf(dia);
        if (incrementaPersonajeDia(personajeId, sqlDia, scoreDelta, pesoDelta) > 0) return;
        int insertadas = jdbcTemplate.update("""
                INSERT INTO voto_personaje_dia_stats
                    (personaje_id, dia, votos_score, peso_votos, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT DO NOTHING
                """, personajeId, sqlDia, scoreDelta, pesoDelta);
        if (insertadas == 0) {
            incrementaPersonajeDia(personajeId, sqlDia, scoreDelta, pesoDelta);
        }
    }

    private int incrementaPersonajeDia(Long personajeId, Date sqlDia, BigDecimal scoreDelta, BigDecimal pesoDelta) {
        return jdbcTemplate.update("""
                UPDATE voto_personaje_dia_stats
                SET votos_score = votos_score + ?,
                    peso_votos = peso_votos + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE personaje_id = ?
                  AND dia = ?
                """, scoreDelta, pesoDelta, personajeId, sqlDia);
    }

    private void upsertEnfrentamiento(Long enfrentamientoId, Long personajeId, BigDecimal scoreDelta) {
        if (incrementaEnfrentamiento(enfrentamientoId, personajeId, scoreDelta) > 0) return;
        int insertadas = jdbcTemplate.update("""
                INSERT INTO voto_enfrentamiento_stats
                    (enfrentamiento_id, personaje_id, votos_score, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT DO NOTHING
                """, enfrentamientoId, personajeId, scoreDelta);
        if (insertadas == 0) {
            incrementaEnfrentamiento(enfrentamientoId, personajeId, scoreDelta);
        }
    }

    private int incrementaEnfrentamiento(Long enfrentamientoId, Long personajeId, BigDecimal scoreDelta) {
        return jdbcTemplate.update("""
                UPDATE voto_enfrentamiento_stats
                SET votos_score = votos_score + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE enfrentamiento_id = ?
                  AND personaje_id = ?
                """, scoreDelta, enfrentamientoId, personajeId);
    }

    private void upsertTorneo(Long torneoId) {
        if (incrementaTorneo(torneoId) > 0) return;
        int insertadas = jdbcTemplate.update("""
                INSERT INTO voto_torneo_stats (torneo_id, votos_total, updated_at)
                VALUES (?, 1, CURRENT_TIMESTAMP)
                ON CONFLICT DO NOTHING
                """, torneoId);
        if (insertadas == 0) {
            incrementaTorneo(torneoId);
        }
    }

    private int incrementaTorneo(Long torneoId) {
        return jdbcTemplate.update("""
                UPDATE voto_torneo_stats
                SET votos_total = votos_total + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE torneo_id = ?
                """, torneoId);
    }

    private Map<Long, Double> scoresPorPersonaje(Enfrentamiento enfrentamiento) {
        if (enfrentamiento == null || enfrentamiento.getId() == null) {
            return Map.of();
        }
        return jdbcTemplate.query("""
                SELECT personaje_id, votos_score
                FROM voto_enfrentamiento_stats
                WHERE enfrentamiento_id = ?
                """, (rs, rowNum) -> Map.entry(
                    rs.getLong("personaje_id"),
                    rs.getBigDecimal("votos_score").doubleValue()),
                enfrentamiento.getId())
                .stream()
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    private PersonajeStats statsPersonaje(Long personajeId) {
        List<PersonajeStats> rows = jdbcTemplate.query("""
                SELECT personaje_id, votos_score, peso_votos
                FROM voto_personaje_stats
                WHERE personaje_id = ?
                """, (rs, rowNum) -> new PersonajeStats(
                    rs.getLong("personaje_id"),
                    rs.getBigDecimal("votos_score").doubleValue(),
                    rs.getBigDecimal("peso_votos").doubleValue()),
                personajeId);
        return rows.isEmpty() ? new PersonajeStats(personajeId, 0.0, 0.0) : rows.get(0);
    }

    public record PersonajeDelta(Personaje personaje, BigDecimal votosScore, BigDecimal pesoVotos) {
        public double votosScoreDouble() {
            return votosScore == null ? 0.0 : votosScore.doubleValue();
        }

        public double pesoVotosDouble() {
            return pesoVotos == null ? 0.0 : pesoVotos.doubleValue();
        }
    }

    public record PersonajeStats(Long personajeId, double votosScore, double pesoVotos) {}

    public record VotoStatsSnapshot(
            Map<Long, Double> scoresPorPersonaje,
            Map<Long, PersonajeStats> statsPorPersonaje,
            List<PersonajeDelta> deltas) {

        public double scoreDe(Personaje personaje) {
            if (personaje == null || personaje.getId() == null) return 0.0;
            return scoresPorPersonaje.getOrDefault(personaje.getId(), 0.0);
        }

        public PersonajeStats statsDe(Personaje personaje) {
            if (personaje == null || personaje.getId() == null) return ZERO_STATS;
            return statsPorPersonaje.getOrDefault(personaje.getId(),
                    new PersonajeStats(personaje.getId(), 0.0, 0.0));
        }
    }
}
