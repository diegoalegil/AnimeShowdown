package com.diegoalegil.animeshowdown.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.diegoalegil.animeshowdown.event.VotoScoreEvent;

/**
 * Materializa el score de personaje (personaje_voto_score, V53) en respuesta a
 * cada voto. Mismo patrón que {@link CartaDropListener} y BadgeEventListener:
 * {@code @TransactionalEventListener(AFTER_COMMIT)} para materializar sólo votos
 * ya persistidos, y {@code @Async} para no sostener el lock de la fila del
 * personaje en la transacción del POST /votar — ese era el punto de
 * serialización del hot path bajo votos concurrentes al mismo personaje.
 *
 * <p>Best-effort: una materialización fallida nunca debe afectar al voto que la
 * originó (ya commiteado). La consistencia de lectura de cartas la acota el TTL
 * de 30s del caché {@code cartas-votos-score}.
 */
@Component
public class VotoScoreListener {

    private static final Logger log = LoggerFactory.getLogger(VotoScoreListener.class);

    private final PersonajeVotoScoreService personajeVotoScoreService;

    public VotoScoreListener(PersonajeVotoScoreService personajeVotoScoreService) {
        this.personajeVotoScoreService = personajeVotoScoreService;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onVoto(VotoScoreEvent ev) {
        try {
            personajeVotoScoreService.registrar(
                    ev.empate(), ev.votoPersonajeId(), ev.personaje1Id(), ev.personaje2Id());
        } catch (Exception e) {
            log.warn("Materialización de voto_score falló (no rompe el voto): err={}", e.getMessage());
        }
    }
}
