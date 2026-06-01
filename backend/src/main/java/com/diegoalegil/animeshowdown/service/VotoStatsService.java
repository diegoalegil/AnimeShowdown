package com.diegoalegil.animeshowdown.service;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.dao.DuplicateKeyException;
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
        LocalDate dia = diaDe(voto);
        Enfrentamiento enfrentamiento = voto.getEnfrentamiento();

        for (PersonajeDelta delta : deltas) {
            upsertPersonaje(delta.personaje().getId(), delta.votosScore(), delta.pesoVotos());
            upsertPersonajeDia(delta.personaje().getId(), dia, delta.votosScore(), delta.pesoVotos());
            if (enfrentamiento != null && enfrentamiento.getId() != null) {
                upsertEnfrentamiento(enfrentamiento.getId(), delta.personaje().getId(), delta.votosScore());
            }
        }
        if (enfrentamiento != null
                && enfrentamiento.getTorneo() != null
                && enfrentamiento.getTorneo().getId() != null) {
            upsertTorneo(enfrentamiento.getTorneo().getId());
        }

        return snapshot(enfrentamiento, deltas);
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

    private LocalDate diaDe(Voto voto) {
        LocalDateTime fecha = voto.getFecha() == null ? LocalDateTime.now() : voto.getFecha();
        return fecha.toLocalDate();
    }

    private void upsertPersonaje(Long personajeId, BigDecimal scoreDelta, BigDecimal pesoDelta) {
        int updated = jdbcTemplate.update("""
                UPDATE voto_personaje_stats
                SET votos_score = votos_score + ?,
                    peso_votos = peso_votos + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE personaje_id = ?
                """, scoreDelta, pesoDelta, personajeId);
        if (updated > 0) return;
        try {
            jdbcTemplate.update("""
                    INSERT INTO voto_personaje_stats
                        (personaje_id, votos_score, peso_votos, updated_at)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                    """, personajeId, scoreDelta, pesoDelta);
        } catch (DuplicateKeyException ex) {
            upsertPersonaje(personajeId, scoreDelta, pesoDelta);
        }
    }

    private void upsertPersonajeDia(Long personajeId, LocalDate dia, BigDecimal scoreDelta, BigDecimal pesoDelta) {
        Date sqlDia = Date.valueOf(dia);
        int updated = jdbcTemplate.update("""
                UPDATE voto_personaje_dia_stats
                SET votos_score = votos_score + ?,
                    peso_votos = peso_votos + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE personaje_id = ?
                  AND dia = ?
                """, scoreDelta, pesoDelta, personajeId, sqlDia);
        if (updated > 0) return;
        try {
            jdbcTemplate.update("""
                    INSERT INTO voto_personaje_dia_stats
                        (personaje_id, dia, votos_score, peso_votos, updated_at)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """, personajeId, sqlDia, scoreDelta, pesoDelta);
        } catch (DuplicateKeyException ex) {
            upsertPersonajeDia(personajeId, dia, scoreDelta, pesoDelta);
        }
    }

    private void upsertEnfrentamiento(Long enfrentamientoId, Long personajeId, BigDecimal scoreDelta) {
        int updated = jdbcTemplate.update("""
                UPDATE voto_enfrentamiento_stats
                SET votos_score = votos_score + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE enfrentamiento_id = ?
                  AND personaje_id = ?
                """, scoreDelta, enfrentamientoId, personajeId);
        if (updated > 0) return;
        try {
            jdbcTemplate.update("""
                    INSERT INTO voto_enfrentamiento_stats
                        (enfrentamiento_id, personaje_id, votos_score, updated_at)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                    """, enfrentamientoId, personajeId, scoreDelta);
        } catch (DuplicateKeyException ex) {
            upsertEnfrentamiento(enfrentamientoId, personajeId, scoreDelta);
        }
    }

    private void upsertTorneo(Long torneoId) {
        int updated = jdbcTemplate.update("""
                UPDATE voto_torneo_stats
                SET votos_total = votos_total + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE torneo_id = ?
                """, torneoId);
        if (updated > 0) return;
        try {
            jdbcTemplate.update("""
                    INSERT INTO voto_torneo_stats (torneo_id, votos_total, updated_at)
                    VALUES (?, 1, CURRENT_TIMESTAMP)
                    """, torneoId);
        } catch (DuplicateKeyException ex) {
            upsertTorneo(torneoId);
        }
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
