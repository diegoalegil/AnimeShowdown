package com.diegoalegil.animeshowdown.service;

import java.util.function.Supplier;

import org.springframework.stereotype.Component;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;

@Component
public class AnimeShowdownMetrics {

    private final Counter votosTotal;
    private final Timer rankingRecalcDuration;

    public AnimeShowdownMetrics(MeterRegistry registry) {
        this.votosTotal = Counter.builder("as.votos.total")
                .description("Total de votos registrados por el backend")
                .register(registry);
        this.rankingRecalcDuration = Timer.builder("as.ranking.recalc.duration")
                .description("Tiempo empleado en recalcular rankings públicos")
                .publishPercentileHistogram(false)
                .register(registry);
    }

    public void votoRegistrado() {
        votosTotal.increment();
    }

    public <T> T recordRanking(Supplier<T> supplier) {
        return rankingRecalcDuration.record(supplier);
    }
}
