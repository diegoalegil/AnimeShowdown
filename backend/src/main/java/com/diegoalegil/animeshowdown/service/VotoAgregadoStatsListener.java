package com.diegoalegil.animeshowdown.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.diegoalegil.animeshowdown.event.VotoAgregadoEvent;

/**
 * Materializa las agregaciones diaria/por-torneo del voto en AFTER_COMMIT
 * @Async, igual que VotoScoreListener/BadgeEventListener. Saca esos upserts del
 * hilo de la request del POST /votar (eran round-trips a la DB remota que no
 * alimentan ni la respuesta ni el delta WS).
 *
 * <p>Best-effort: un fallo aquí nunca debe afectar al voto ya commiteado.
 */
@Component
public class VotoAgregadoStatsListener {

    private static final Logger log = LoggerFactory.getLogger(VotoAgregadoStatsListener.class);

    private final VotoStatsService votoStatsService;

    public VotoAgregadoStatsListener(VotoStatsService votoStatsService) {
        this.votoStatsService = votoStatsService;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onVoto(VotoAgregadoEvent ev) {
        try {
            votoStatsService.registrarAgregadosDiarios(ev.deltas(), ev.dia(), ev.torneoId());
        } catch (Exception e) {
            log.warn("Materialización de agregados diaria/torneo falló (no rompe el voto): err={}",
                    e.getMessage());
        }
    }
}
