package com.diegoalegil.animeshowdown.service;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.diegoalegil.animeshowdown.model.DueloLiveChoice;
import com.diegoalegil.animeshowdown.model.DueloLiveRonda;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

/**
 * Decisión de la comunidad y del bot para una ronda de duelo live.
 *
 * <p>Extraído de {@code DueloLiveService} (split de mantenibilidad): es lógica
 * determinista de SOLO LECTURA (cuenta votos existentes; sin locks ni mutación),
 * así que se ejecuta en la transacción del llamador sin cambiar su semántica.
 * El voto del bot es determinista por ronda (mismo seed → mismo resultado).
 * Comportamiento idéntico al original.
 */
@Component
public class DueloLiveBotPolicy {

    private final VotoRepository votoRepository;
    private final int botFallaCada;

    public DueloLiveBotPolicy(VotoRepository votoRepository,
            @Value("${app.duelo-live.bot-falla-cada:2}") int botFallaCada) {
        this.votoRepository = votoRepository;
        // Mínimo 2: con 1 el bot fallaría todas las rondas y el modo pierde gracia.
        this.botFallaCada = Math.max(2, botFallaCada);
    }

    /** Puntuación de comunidad (votos históricos) de los dos personajes de la ronda. */
    public VoteScores scoresComunidad(DueloLiveRonda ronda) {
        Map<Long, Double> scores = votosPorPersonajeIds(List.of(
                ronda.getPersonajeA().getId(),
                ronda.getPersonajeB().getId()));
        return new VoteScores(
                scores.getOrDefault(ronda.getPersonajeA().getId(), 0.0),
                scores.getOrDefault(ronda.getPersonajeB().getId(), 0.0));
    }

    /** Cuál es la elección "correcta" según la comunidad (o EMPATE si están igualadas). */
    public DueloLiveChoice decisionComunidad(DueloLiveRonda ronda, VoteScores scores) {
        double a = scores.a();
        double b = scores.b();
        if (Double.compare(a, 0.0) == 0 && Double.compare(b, 0.0) == 0) {
            return ronda.getPersonajeA().getId() <= ronda.getPersonajeB().getId()
                    ? DueloLiveChoice.A
                    : DueloLiveChoice.B;
        }
        if (Double.compare(a, b) == 0) return DueloLiveChoice.EMPATE;
        return a > b ? DueloLiveChoice.A : DueloLiveChoice.B;
    }

    /** Voto del bot: acierta la decisión de comunidad salvo ~1 de cada 2 rondas. */
    public DueloLiveChoice votoBot(DueloLiveRonda ronda) {
        VoteScores scores = scoresComunidad(ronda);
        DueloLiveChoice correcta = decisionComunidad(ronda, scores);
        if (correcta == DueloLiveChoice.EMPATE) {
            return scores.a() >= scores.b() ? DueloLiveChoice.A : DueloLiveChoice.B;
        }
        if (botFallaRonda(ronda)) {
            return correcta == DueloLiveChoice.A ? DueloLiveChoice.B : DueloLiveChoice.A;
        }
        return correcta;
    }

    private Map<Long, Double> votosPorPersonajeIds(Collection<Long> personajeIds) {
        return votoRepository.countByPersonajeIds(personajeIds).stream()
                .collect(Collectors.toMap(
                        row -> ((Number) row[0]).longValue(),
                        row -> ((Number) row[1]).doubleValue()));
    }

    private boolean botFallaRonda(DueloLiveRonda ronda) {
        long seed = 17L;
        seed = seed * 31 + nullSafeId(ronda.getId());
        seed = seed * 31 + nullSafeId(ronda.getDuelo() == null ? null : ronda.getDuelo().getId());
        seed = seed * 31 + ronda.getNumero();
        seed = seed * 31 + nullSafeId(ronda.getPersonajeA() == null ? null : ronda.getPersonajeA().getId());
        seed = seed * 31 + nullSafeId(ronda.getPersonajeB() == null ? null : ronda.getPersonajeB().getId());
        // El bot falla ~1 de cada `botFallaCada` rondas (configurable vía
        // app.duelo-live.bot-falla-cada; default 2 → falla el 50% y es
        // ganable). Sigue siendo determinista por ronda (mismo seed →
        // mismo resultado).
        return Math.floorMod(seed, botFallaCada) == 0;
    }

    private static long nullSafeId(Long id) {
        return id == null ? 0L : id;
    }

    /** Puntuación de comunidad de los dos personajes (a = personaje A, b = personaje B). */
    public record VoteScores(double a, double b) {
    }
}
