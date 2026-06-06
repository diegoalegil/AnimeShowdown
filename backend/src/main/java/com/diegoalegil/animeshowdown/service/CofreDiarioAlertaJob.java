package com.diegoalegil.animeshowdown.service;

import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduler diario del recordatorio del cofre ({@link CofreDiarioAlertaService}).
 * Por defecto a las 18:00 UTC: a esa hora "no-reclamante" ya es significativo
 * (tuvo el día para reclamar). Apagable en caliente con
 * {@code app.alertas-cofre.enabled=false}; hora con {@code app.alertas-cofre.cron}.
 *
 * <p>En multi-instancia el {@link JobLockService} garantiza que solo una réplica
 * dispara el fan-out (TTL 20h &lt; intervalo diario), igual que las alertas de
 * favorito y la Arena.
 */
@Component
@ConditionalOnProperty(name = "app.alertas-cofre.enabled", havingValue = "true", matchIfMissing = true)
public class CofreDiarioAlertaJob {

    private static final Logger log = LoggerFactory.getLogger(CofreDiarioAlertaJob.class);
    private static final Duration LOCK_TTL = Duration.ofHours(20);

    private final CofreDiarioAlertaService service;
    private final JobLockService jobLock;

    public CofreDiarioAlertaJob(CofreDiarioAlertaService service, JobLockService jobLock) {
        this.service = service;
        this.jobLock = jobLock;
    }

    @Scheduled(cron = "${app.alertas-cofre.cron:0 0 18 * * *}", zone = "UTC")
    public void notificarCofre() {
        if (!jobLock.intentarAdquirir("cofre_diario_alerta", LOCK_TTL)) {
            return; // otra instancia ya envió los recordatorios de hoy
        }
        try {
            int creadas = service.notificarCofreDisponible();
            if (creadas > 0) {
                log.info("Cofre diario: {} recordatorios enviados", creadas);
            }
        } catch (Exception e) {
            log.warn("Cofre diario: el job falló: {}", e.getMessage());
        }
    }
}
