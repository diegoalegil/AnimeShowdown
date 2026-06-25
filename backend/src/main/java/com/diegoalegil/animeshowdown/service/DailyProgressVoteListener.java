package com.diegoalegil.animeshowdown.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.diegoalegil.animeshowdown.event.VotoRegistradoEvent;

/**
 * Registra cada voto persistido en el progreso diario server-side. Mismo patrón
 * que {@code CartaDropListener}: {@code @TransactionalEventListener(AFTER_COMMIT)}
 * para contar solo votos que de verdad se persistieron, y {@code @Async} para no
 * acoplar la latencia del voto a esta escritura. Los votos anónimos (sin usuario)
 * no se registran aquí: su progreso vive en localStorage.
 */
@Component
public class DailyProgressVoteListener {

    private static final Logger log = LoggerFactory.getLogger(DailyProgressVoteListener.class);

    private final DailyProgressService dailyProgressService;

    public DailyProgressVoteListener(DailyProgressService dailyProgressService) {
        this.dailyProgressService = dailyProgressService;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onVotoRegistrado(VotoRegistradoEvent evento) {
        if (evento.usuario() == null || evento.usuario().getId() == null) {
            return;
        }
        try {
            // fechaVoto va sellada desde la tx del voto; si es null (eventos
            // legacy) el servicio cae a la fecha del servidor.
            dailyProgressService.registrarVoto(evento.usuario().getId(), evento.fechaVoto(), 1);
        } catch (RuntimeException e) {
            // El progreso diario es un nice-to-have: nunca debe tumbar el voto.
            log.warn("No se pudo registrar el voto en daily_progress (usuario {}): {}",
                    evento.usuario().getId(), e.getMessage());
        }
    }
}
