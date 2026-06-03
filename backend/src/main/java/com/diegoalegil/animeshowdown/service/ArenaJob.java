package com.diegoalegil.animeshowdown.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Mantiene el pool de la Arena en background (resuelve maduros + repone parejas).
 * Mismo patrón que {@link TorneoAutoAdvanceJob}: {@code @Scheduled} con flag de
 * propiedad para poder desactivarlo en tests/entornos. Fuera del hot path del
 * voto, así que su coste (muestreo + upserts) no afecta a la latencia del POST.
 */
@Component
@ConditionalOnProperty(prefix = "app.arena", name = "enabled", havingValue = "true", matchIfMissing = true)
public class ArenaJob {

    private static final Logger log = LoggerFactory.getLogger(ArenaJob.class);

    private final ArenaService arenaService;

    public ArenaJob(ArenaService arenaService) {
        this.arenaService = arenaService;
    }

    @Scheduled(
            initialDelayString = "${app.arena.initial-delay-ms:90000}",
            fixedDelayString = "${app.arena.delay-ms:60000}")
    public void mantenerArena() {
        try {
            arenaService.mantener();
        } catch (Exception e) {
            log.warn("Mantenimiento de la Arena falló: err={}", e.getMessage());
        }
    }
}
