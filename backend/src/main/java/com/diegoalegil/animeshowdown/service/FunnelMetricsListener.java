package com.diegoalegil.animeshowdown.service;

import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.diegoalegil.animeshowdown.event.UsuarioRegistradoEvent;

/**
 * Cuenta el embudo de adquisición server-side enganchando los eventos de
 * dominio que ya existen, sin tocar los controllers grandes (AuthController,
 * OAuthAccountService) ni acoplar su lógica a métricas.
 *
 * <p>Hoy solo cubre el registro porque {@link UsuarioRegistradoEvent} es el
 * único punto del funnel que emite evento; la verificación de email y el voto
 * incrementan su contador en línea desde sus servicios. Si en el futuro esos
 * pasos emiten eventos, se centralizan aquí.
 *
 * <p>Se ata a {@link TransactionPhase#AFTER_COMMIT} (con
 * {@code fallbackExecution = true} porque {@code AuthController.registro} no es
 * transaccional) para contar registros que de verdad se persistieron — igual
 * que {@code FundadorBadgeService}.
 */
@Component
public class FunnelMetricsListener {

    private final AnimeShowdownMetrics metrics;

    public FunnelMetricsListener(AnimeShowdownMetrics metrics) {
        this.metrics = metrics;
    }

    @TransactionalEventListener(
            phase = TransactionPhase.AFTER_COMMIT,
            fallbackExecution = true)
    public void onUsuarioRegistrado(UsuarioRegistradoEvent event) {
        if (event == null || event.usuarioId() == null) return;
        metrics.registroCompletado();
    }
}
