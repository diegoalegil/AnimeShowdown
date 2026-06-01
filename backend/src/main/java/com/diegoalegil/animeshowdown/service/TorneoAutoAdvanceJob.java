package com.diegoalegil.animeshowdown.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.diegoalegil.animeshowdown.repository.TorneoRepository;

@Component
@ConditionalOnProperty(prefix = "app.torneos.auto-advance", name = "enabled", havingValue = "true", matchIfMissing = true)
public class TorneoAutoAdvanceJob {

    private static final Logger log = LoggerFactory.getLogger(TorneoAutoAdvanceJob.class);

    private final TorneoRepository torneoRepository;
    private final TorneoAutoAdvanceService torneoAutoAdvanceService;

    public TorneoAutoAdvanceJob(
            TorneoRepository torneoRepository,
            TorneoAutoAdvanceService torneoAutoAdvanceService) {
        this.torneoRepository = torneoRepository;
        this.torneoAutoAdvanceService = torneoAutoAdvanceService;
    }

    @Scheduled(
            initialDelayString = "${app.torneos.auto-advance.initial-delay-ms:60000}",
            fixedDelayString = "${app.torneos.auto-advance.delay-ms:15000}")
    public void avanzarTorneosEnCurso() {
        for (Long torneoId : torneoRepository.findIdsEnCurso()) {
            try {
                torneoAutoAdvanceService.avanzarSiProcede(torneoId, "scheduler");
            } catch (Exception e) {
                log.warn("Auto-advance scheduler falló: torneo={} err={}",
                        torneoId, e.getMessage());
            }
        }
    }
}
