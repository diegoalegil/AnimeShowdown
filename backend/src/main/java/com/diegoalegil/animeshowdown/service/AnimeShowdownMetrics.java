package com.diegoalegil.animeshowdown.service;

import java.util.function.Supplier;

import org.springframework.stereotype.Component;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class AnimeShowdownMetrics {

    private final Counter votosTotal;
    private final Timer rankingRecalcDuration;
    private final DistributionSummary dueloSugeridoEloDiff;
    private final DistributionSummary dueloLiveWaitingSeconds;
    private final DistributionSummary dueloLiveRoundDecisionMs;
    private final AtomicInteger dueloLiveActiveMatches = new AtomicInteger(0);
    private final MeterRegistry registry;

    public AnimeShowdownMetrics(MeterRegistry registry) {
        this.registry = registry;
        this.votosTotal = Counter.builder("as.votos.total")
                .description("Total de votos registrados por el backend")
                .register(registry);
        this.rankingRecalcDuration = Timer.builder("as.ranking.recalc.duration")
                .description("Tiempo empleado en recalcular rankings públicos")
                .publishPercentileHistogram(false)
                .register(registry);
        this.dueloSugeridoEloDiff = DistributionSummary.builder("as.duelo.sugerido.elo.diff")
                .description("Diferencia de ELO estimado entre personajes sugeridos en /api/votar/sugerir-duelo")
                .baseUnit("elo")
                .publishPercentileHistogram(false)
                .register(registry);
        this.dueloLiveWaitingSeconds = DistributionSummary.builder("as.duelo.live.waiting.seconds")
                .description("Tiempo de espera en cola antes de emparejar un duelo PvP")
                .baseUnit("seconds")
                .publishPercentileHistogram(false)
                .register(registry);
        this.dueloLiveRoundDecisionMs = DistributionSummary.builder("as.duelo.live.round.decision.ms")
                .description("Latencia entre cierre de ronda PvP y decisión de resultado")
                .baseUnit("milliseconds")
                .publishPercentileHistogram(false)
                .register(registry);
        io.micrometer.core.instrument.Gauge.builder("as.duelo.live.active.matches", dueloLiveActiveMatches, AtomicInteger::get)
                .description("Duelos PvP activos ahora")
                .register(registry);
    }

    public void votoRegistrado() {
        votosTotal.increment();
    }

    public <T> T recordRanking(Supplier<T> supplier) {
        return rankingRecalcDuration.record(supplier);
    }

    public void dueloSugerido(int eloDiff) {
        dueloSugeridoEloDiff.record(eloDiff);
    }

    public void dueloLiveWaitingSeconds(double seconds) {
        dueloLiveWaitingSeconds.record(Math.max(0, seconds));
    }

    public void dueloLiveCompleted(String outcome) {
        Counter.builder("as.duelo.live.completed")
                .description("Duelos PvP completados por resultado")
                .tag("outcome", outcome == null ? "unknown" : outcome)
                .register(registry)
                .increment();
    }

    public void dueloLiveActiveMatches(int active) {
        dueloLiveActiveMatches.set(Math.max(0, active));
    }

    public void dueloLiveRoundDecisionMs(long ms) {
        dueloLiveRoundDecisionMs.record(Math.max(0, ms));
    }
}
