package com.diegoalegil.animeshowdown.service;

import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduler diario de {@link AlertaFavoritoMovimientoService}. Aislado del
 * service para que la lógica de fan-out sea testeable sin tocar el cron.
 *
 * <p>{@code app.alertas-favorito.enabled=false} lo apaga en caliente sin
 * redeploy. La hora se configura con {@code app.alertas-favorito.cron}.
 *
 * <p>En multi-instancia, dos réplicas disparando el cron a la vez enviarían
 * notificaciones DUPLICADAS. El {@link JobLockService} garantiza que solo una
 * réplica ejecuta el fan-out (TTL 20h &lt; intervalo diario de 24h).
 */
@Component
@ConditionalOnProperty(name = "app.alertas-favorito.enabled", havingValue = "true", matchIfMissing = true)
public class AlertaFavoritoMovimientoJob {

    private static final Logger log = LoggerFactory.getLogger(AlertaFavoritoMovimientoJob.class);
    private static final Duration LOCK_TTL = Duration.ofHours(20);

    private final AlertaFavoritoMovimientoService service;
    private final JobLockService jobLock;

    public AlertaFavoritoMovimientoJob(AlertaFavoritoMovimientoService service, JobLockService jobLock) {
        this.service = service;
        this.jobLock = jobLock;
    }

    @Scheduled(cron = "${app.alertas-favorito.cron:0 0 9 * * *}", zone = "UTC")
    public void notificarMovimientos() {
        if (!jobLock.intentarAdquirir("alerta_favorito", LOCK_TTL)) {
            return; // otra instancia ya envió las alertas de favorito de hoy
        }
        try {
            int creadas = service.notificarMovimientos();
            if (creadas > 0) {
                log.info("Alertas de favorito: {} notificaciones enviadas", creadas);
            }
        } catch (Exception e) {
            log.warn("Alertas de favorito: el job falló: {}", e.getMessage());
        }
    }
}
