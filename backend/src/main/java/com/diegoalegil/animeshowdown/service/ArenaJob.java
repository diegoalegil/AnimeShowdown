package com.diegoalegil.animeshowdown.service;

import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Mantiene el pool de la Arena en background (resuelve maduros + repone parejas).
 * Mismo patrón que {@link TorneoAutoAdvanceJob}: {@code @Scheduled} con flag de
 * propiedad para poder desactivarlo en tests/entornos. Fuera del hot path del
 * voto, así que su coste (muestreo + upserts) no afecta a la latencia del POST.
 *
 * <p>En multi-instancia, dos réplicas reponiendo el pool a la vez lo duplicarían
 * (cada una ve "pool bajo" y añade N parejas). El {@link JobLockService} hace que
 * solo una réplica corra cada tick (TTL = mitad del delay: no bloquea el
 * siguiente tick legítimo, pero descarta una ejecución concurrente).
 */
@Component
@ConditionalOnProperty(prefix = "app.arena", name = "enabled", havingValue = "true", matchIfMissing = true)
public class ArenaJob {

    private static final Logger log = LoggerFactory.getLogger(ArenaJob.class);

    private final ArenaService arenaService;
    private final JobLockService jobLock;
    private final Duration lockTtl;

    public ArenaJob(ArenaService arenaService, JobLockService jobLock,
            @Value("${app.arena.delay-ms:60000}") long delayMs) {
        this.arenaService = arenaService;
        this.jobLock = jobLock;
        this.lockTtl = Duration.ofMillis(Math.max(1000, delayMs / 2));
    }

    @Scheduled(
            initialDelayString = "${app.arena.initial-delay-ms:90000}",
            fixedDelayString = "${app.arena.delay-ms:60000}")
    public void mantenerArena() {
        if (!jobLock.intentarAdquirir("arena_mantener", lockTtl)) {
            return; // otra instancia ya está manteniendo la Arena este tick
        }
        try {
            arenaService.mantener();
        } catch (Exception e) {
            log.warn("Mantenimiento de la Arena falló: err={}", e.getMessage());
        }
    }
}
