package com.diegoalegil.animeshowdown.service;

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
 */
@Component
@ConditionalOnProperty(name = "app.alertas-favorito.enabled", havingValue = "true", matchIfMissing = true)
public class AlertaFavoritoMovimientoJob {

    private static final Logger log = LoggerFactory.getLogger(AlertaFavoritoMovimientoJob.class);

    private final AlertaFavoritoMovimientoService service;

    public AlertaFavoritoMovimientoJob(AlertaFavoritoMovimientoService service) {
        this.service = service;
    }

    @Scheduled(cron = "${app.alertas-favorito.cron:0 0 9 * * *}", zone = "UTC")
    public void notificarMovimientos() {
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
