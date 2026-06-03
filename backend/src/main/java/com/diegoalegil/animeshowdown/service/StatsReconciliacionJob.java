package com.diegoalegil.animeshowdown.service;

import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduler nocturno de {@link StatsReconciliacionService}: corrige el drift de
 * las stats materializadas (mantenidas por listeners async best-effort) contra
 * la fuente de verdad {@code votos}.
 *
 * <p>Corre de madrugada (poco tráfico) para minimizar carreras con votos vivos;
 * y como la reconciliación es convergente, cualquier error transitorio se
 * autocorrige en la siguiente corrida. {@code app.reconciliacion.enabled=false}
 * lo apaga. {@link JobLockService} garantiza una sola ejecución en multi-instancia.
 */
@Component
@ConditionalOnProperty(name = "app.reconciliacion.enabled", havingValue = "true", matchIfMissing = true)
public class StatsReconciliacionJob {

    private static final Logger log = LoggerFactory.getLogger(StatsReconciliacionJob.class);
    private static final Duration LOCK_TTL = Duration.ofHours(20);

    private final StatsReconciliacionService service;
    private final JobLockService jobLock;

    public StatsReconciliacionJob(StatsReconciliacionService service, JobLockService jobLock) {
        this.service = service;
        this.jobLock = jobLock;
    }

    @Scheduled(cron = "${app.reconciliacion.cron:0 30 4 * * *}", zone = "UTC")
    public void reconciliar() {
        if (!jobLock.intentarAdquirir("reconciliacion_stats", LOCK_TTL)) {
            return; // otra instancia ya reconcilió hoy
        }
        try {
            service.reconciliar();
        } catch (Exception e) {
            log.warn("Reconciliación de stats falló: {}", e.getMessage());
        }
    }
}
