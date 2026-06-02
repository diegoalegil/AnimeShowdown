package com.diegoalegil.animeshowdown.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.diegoalegil.animeshowdown.event.EnfrentamientoVotadoEvent;

@Component
public class TorneoAutoAdvanceListener {

    private static final Logger log = LoggerFactory.getLogger(TorneoAutoAdvanceListener.class);

    private final TorneoAutoAdvanceService torneoAutoAdvanceService;

    public TorneoAutoAdvanceListener(TorneoAutoAdvanceService torneoAutoAdvanceService) {
        this.torneoAutoAdvanceService = torneoAutoAdvanceService;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onVoto(EnfrentamientoVotadoEvent event) {
        try {
            torneoAutoAdvanceService.avanzarSiProcede(event.torneoId(), "vote");
        } catch (Exception e) {
            log.warn("Auto-advance tras voto falló: torneo={} enfrentamiento={} err={}",
                    event.torneoId(), event.enfrentamientoId(), e.getMessage());
        }
    }
}
