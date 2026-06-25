package com.diegoalegil.animeshowdown.service;

import java.time.Clock;
import java.time.LocalDate;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.diegoalegil.animeshowdown.event.DueloLiveFinalizadoEvent;
import com.diegoalegil.animeshowdown.event.PrediccionResueltaEvent;
import com.diegoalegil.animeshowdown.event.VotoRegistradoEvent;
import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

/**
 * Dropea moneda en respuesta a las acciones de juego (mismo patrón que
 * {@link BadgeEventListener}): {@code @TransactionalEventListener(AFTER_COMMIT)}
 * para sólo recompensar si la acción se persistió, y {@code @Async} para no
 * bloquear la respuesta HTTP.
 *
 * <p>Fuentes de drop (decisión del owner):
 * <ul>
 *   <li><b>Votar</b> — misión diaria (primer voto del día, 1 drop/día) + hito
 *       cada N votos.</li>
 *   <li><b>Torneo</b> — predicciones resueltas a favor (aciertos nuevos).</li>
 *   <li><b>Daily games</b> — ganar un duelo live PvP.</li>
 * </ul>
 *
 * <p>Cada handler envuelve la lógica en try/catch: un drop fallido NUNCA debe
 * afectar la acción de juego que lo originó.
 */
@Component
public class CartaDropListener {

    private static final Logger log = LoggerFactory.getLogger(CartaDropListener.class);

    private final DropService dropService;
    private final VotoRepository votoRepository;
    private final UsuarioRepository usuarioRepository;
    private final Clock clock;
    private final int votoCadaN;

    public CartaDropListener(
            DropService dropService,
            VotoRepository votoRepository,
            UsuarioRepository usuarioRepository,
            Clock clock,
            @Value("${app.cartas.drop.voto-cada-n:10}") int votoCadaN) {
        this.dropService = dropService;
        this.votoRepository = votoRepository;
        this.usuarioRepository = usuarioRepository;
        this.clock = clock;
        this.votoCadaN = Math.max(1, votoCadaN);
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onVoto(VotoRegistradoEvent ev) {
        Usuario usuario = ev.usuario();
        if (usuario == null) {
            return;
        }
        try {
            // Misión diaria (idempotente por día) + hito cada N votos. La regla
            // vive en DropService.candidatosVoto (fuente única que comparten este
            // listener y la previsualización del endpoint); aquí se APLICAN.
            long totalVotos = votoRepository.countByUsuario(usuario);
            // Usa la fecha SELLADA en la tx del voto, no LocalDate.now(): este
            // handler corre @Async tras el commit, así que un voto de las 23:59
            // del día D procesado tras medianoche generaría la referencia de la
            // misión diaria "dia:D+1". Cuando el usuario vota de verdad el día
            // D+1, esa referencia ya existe -> MonederoService la trata como
            // idempotente y NO paga la misión de D+1: pierde un día completo.
            // Mismo blindaje que DailyProgressVoteListener (fallback a now() solo
            // para eventos legacy sin fecha sellada).
            LocalDate diaVoto = ev.fechaVoto() != null ? ev.fechaVoto() : LocalDate.now(clock);
            for (DropService.DropCandidato c :
                    DropService.candidatosVoto(totalVotos, votoCadaN, diaVoto)) {
                dropService.otorgar(usuario, c.motivo(), c.referencia());
            }
        } catch (Exception e) {
            log.warn("Drop por voto falló (no rompe el voto): usuario={} err={}",
                    usuario.getUsername(), e.getMessage());
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPrediccionResuelta(PrediccionResueltaEvent ev) {
        try {
            Usuario usuario = usuarioRepository.findById(ev.usuarioId()).orElse(null);
            if (usuario == null) {
                return;
            }
            // Referencia = total de aciertos acumulado: si no subió (predijo y
            // falló), es el mismo ref ⇒ idempotente, no dropea.
            dropService.otorgar(usuario, MotivoMovimiento.DROP_TORNEO,
                    "prediccion:" + ev.totalAciertos());
        } catch (Exception e) {
            log.warn("Drop por torneo falló: usuarioId={} err={}", ev.usuarioId(), e.getMessage());
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onDueloFinalizado(DueloLiveFinalizadoEvent ev) {
        try {
            if (ev.ganadorId() == null) {
                return;
            }
            Usuario usuario = usuarioRepository.findById(ev.ganadorId()).orElse(null);
            if (usuario == null) {
                return;
            }
            dropService.otorgar(usuario, MotivoMovimiento.DROP_DUELO, "duelo:" + ev.dueloId());
        } catch (Exception e) {
            log.warn("Drop por duelo falló: dueloId={} err={}", ev.dueloId(), e.getMessage());
        }
    }
}
