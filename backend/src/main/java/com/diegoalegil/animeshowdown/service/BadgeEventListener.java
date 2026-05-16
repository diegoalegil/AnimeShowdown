package com.diegoalegil.animeshowdown.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.diegoalegil.animeshowdown.event.PrediccionResueltaEvent;
import com.diegoalegil.animeshowdown.event.VotoRegistradoEvent;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

/**
 * Listener que desbloquea badges en respuesta a eventos del dominio (Plan v2 §4.2).
 *
 * <p>Por qué {@code @TransactionalEventListener(AFTER_COMMIT)} en lugar de
 * {@code @EventListener}: el evento {@link VotoRegistradoEvent} se publica
 * desde dentro de la transacción del voto. Si esperáramos al commit y al
 * evento le da por fallar (BBDD lenta, etc.), perderíamos el badge. Pero
 * si no esperáramos al commit y la transacción del voto rolleara, el
 * listener desbloquearía el badge sin que el voto existiera en BBDD —
 * inconsistencia. AFTER_COMMIT es el balance correcto.
 *
 * <p>{@code @Async} porque el badge no debe bloquear la respuesta HTTP del
 * voto. El listener corre en el pool de Spring tras devolver el 200 al
 * cliente, y el frontend recibe el toast vía WebSocket cuando se crea la
 * notificación.
 */
@Component
public class BadgeEventListener {

    private static final Logger log = LoggerFactory.getLogger(BadgeEventListener.class);

    private final BadgeService badgeService;
    private final VotoRepository votoRepository;

    public BadgeEventListener(BadgeService badgeService, VotoRepository votoRepository) {
        this.badgeService = badgeService;
        this.votoRepository = votoRepository;
    }

    /**
     * Tras cada voto, comprueba si el usuario alcanza un umbral de count
     * (1 / 100 / 1000). Los desbloqueos son idempotentes en BadgeService,
     * así que si ya tenía el badge no pasa nada.
     */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onVoto(VotoRegistradoEvent ev) {
        Usuario usuario = ev.usuario();
        long totalVotos = votoRepository.countByUsuario(usuario);
        log.debug("Voto registrado: usuario={} totalVotos={}", usuario.getUsername(), totalVotos);

        // Lookup directo por umbral. Hacerlo con if encadenados (en vez de
        // un switch o una lista) es más explícito para el caso "el badge
        // tiene su propio código distinto al número".
        if (totalVotos >= 1) {
            badgeService.desbloquear(usuario, "primer_voto");
        }
        if (totalVotos >= 100) {
            badgeService.desbloquear(usuario, "cien_votos");
        }
        if (totalVotos >= 1000) {
            badgeService.desbloquear(usuario, "mil_votos");
        }
    }

    /**
     * Tras resolver predicciones al finalizar un torneo (Plan v2 §4.4):
     * comprueba racha consecutiva (3 / 10 seguidas) y total absoluto
     * (profeta = 20+). Los desbloqueos son idempotentes, así que si en
     * un mismo torneo el usuario gana varios badges, ninguno se
     * dispara dos veces.
     */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPrediccionResuelta(PrediccionResueltaEvent ev) {
        Usuario usuario = ev.usuario();
        log.debug("Predicción resuelta: usuario={} total={} racha={}",
                usuario.getUsername(), ev.totalAciertos(), ev.rachaConsecutivaActual());

        if (ev.rachaConsecutivaActual() >= 3) {
            badgeService.desbloquear(usuario, "predicciones_3_seguidas");
        }
        if (ev.rachaConsecutivaActual() >= 10) {
            badgeService.desbloquear(usuario, "predicciones_10_seguidas");
        }
        if (ev.totalAciertos() >= 20) {
            badgeService.desbloquear(usuario, "profeta");
        }
    }
}
