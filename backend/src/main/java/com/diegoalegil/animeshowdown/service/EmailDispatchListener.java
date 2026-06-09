package com.diegoalegil.animeshowdown.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.diegoalegil.animeshowdown.event.EmailVerificacionEmitidaEvent;
import com.diegoalegil.animeshowdown.event.NewsletterSuscripcionPendienteEvent;
import com.diegoalegil.animeshowdown.event.PasswordResetSolicitadoEvent;
import com.diegoalegil.animeshowdown.security.LogSanitizer;

/**
 * Despacha los emails transaccionales DESPUÉS del commit que los origina.
 *
 * <p>Antes cada servicio llamaba a {@link EmailService} dentro de su
 * {@code @Transactional}: el email podía salir con el token aún sin commitear
 * (el usuario clicaba un link que todavía no existía en BBDD) o incluso tras
 * un rollback (link muerto para siempre). Con AFTER_COMMIT el email solo sale
 * si el token quedó persistido de verdad.
 *
 * <p>Sin {@code @Async} propio: los métodos de {@link EmailService} ya saltan
 * al pool {@code emailExecutor} (con retry/recover) — un hop extra de executor
 * no aporta nada. {@code fallbackExecution = true} cubre llamadas fuera de
 * transacción: sin el flag, el evento se descartaría EN SILENCIO y el email
 * no saldría nunca.
 *
 * <p>Best-effort: un fallo aquí nunca rompe el flujo ya commiteado (mismo
 * contrato que {@link VotoScoreListener} y {@code CartaDropListener}).
 */
@Component
public class EmailDispatchListener {

    private static final Logger log = LoggerFactory.getLogger(EmailDispatchListener.class);

    private final EmailService emailService;

    public EmailDispatchListener(EmailService emailService) {
        this.emailService = emailService;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onPasswordResetSolicitado(PasswordResetSolicitadoEvent ev) {
        try {
            emailService.enviarCodigoReset(ev.email(), ev.username(), ev.codigo());
        } catch (Exception e) {
            log.warn("Despacho de email de reset falló (no rompe el flujo): email={} err={}",
                    LogSanitizer.email(ev.email()), e.getMessage());
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onEmailVerificacionEmitida(EmailVerificacionEmitidaEvent ev) {
        try {
            emailService.enviarVerificacion(ev.email(), ev.username(), ev.link());
        } catch (Exception e) {
            log.warn("Despacho de email de verificación falló (no rompe el flujo): email={} err={}",
                    LogSanitizer.email(ev.email()), e.getMessage());
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onNewsletterSuscripcionPendiente(NewsletterSuscripcionPendienteEvent ev) {
        try {
            emailService.enviarConfirmacionNewsletter(ev.email(), ev.link());
        } catch (Exception e) {
            log.warn("Despacho de email de newsletter falló (no rompe el flujo): email={} err={}",
                    LogSanitizer.email(ev.email()), e.getMessage());
        }
    }
}
