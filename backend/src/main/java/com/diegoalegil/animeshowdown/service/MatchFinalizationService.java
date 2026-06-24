package com.diegoalegil.animeshowdown.service;

import java.time.Clock;
import java.time.LocalDateTime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

import com.diegoalegil.animeshowdown.event.DueloLiveFinalizadoEvent;
import com.diegoalegil.animeshowdown.model.DueloLive;
import com.diegoalegil.animeshowdown.model.DueloLiveEstado;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.DueloLiveRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

/**
 * Cierre de un duelo live: aplica el ELO PvP, marca el duelo finalizado y
 * publica el evento de drop. Aísla la sección crítica de finalización — lock
 * pesimista ({@code findByIdForFinalize}), guard de idempotencia
 * ({@code finishedEn}) y publicación del evento {@code AFTER_COMMIT}.
 *
 * <p>Extraído de {@code DueloLiveService} (split de mantenibilidad). NO abre
 * transacción propia: sus métodos se ejecutan SIEMPRE dentro de la transacción
 * del orquestador (propagación REQUIRED por defecto), de modo que el lock
 * pesimista, las escrituras y la publicación del evento comparten la misma
 * unidad de trabajo y el mismo boundary de commit que el código original.
 * El orquestador ({@code DueloLiveService}) decide CUÁNDO finalizar; este
 * servicio nunca llama de vuelta a la lógica de rondas (sin ciclo).
 * Comportamiento idéntico al de {@code DueloLiveService} antes del split.
 */
@Component
public class MatchFinalizationService {

    private static final Logger log = LoggerFactory.getLogger(MatchFinalizationService.class);

    private final DueloLiveRepository dueloRepository;
    private final UsuarioRepository usuarioRepository;
    private final PvpEloService pvpEloService;
    private final BadgeService badgeService;
    private final AnimeShowdownMetrics metrics;
    private final DueloLiveNotifier notifier;
    private final ApplicationEventPublisher eventPublisher;
    private final Clock clock;

    public MatchFinalizationService(DueloLiveRepository dueloRepository,
            UsuarioRepository usuarioRepository,
            PvpEloService pvpEloService,
            BadgeService badgeService,
            AnimeShowdownMetrics metrics,
            DueloLiveNotifier notifier,
            ApplicationEventPublisher eventPublisher,
            Clock clock) {
        this.dueloRepository = dueloRepository;
        this.usuarioRepository = usuarioRepository;
        this.pvpEloService = pvpEloService;
        this.badgeService = badgeService;
        this.metrics = metrics;
        this.notifier = notifier;
        this.eventPublisher = eventPublisher;
        this.clock = clock;
    }

    /**
     * Finaliza por marcador (best-of-five resuelto). Recarga con lock pesimista
     * antes de tocar el ELO para garantizar acceso exclusivo: sin esto, el
     * scheduler y un voto cerca de la ventana de cierre podrían finalizar el
     * mismo duelo concurrentemente.
     */
    public void finalizarPorScore(DueloLive duelo) {
        double scoreJ1;
        if (duelo.getScoreJugador1() > duelo.getScoreJugador2()) {
            scoreJ1 = 1.0;
            duelo.setGanador(duelo.getJugador1());
            badgeService.desbloquear(duelo.getJugador1(), "primera_victoria_pvp");
        } else if (duelo.getScoreJugador2() > duelo.getScoreJugador1()) {
            scoreJ1 = 0.0;
            duelo.setGanador(duelo.getJugador2());
            if (duelo.getJugador2() != null) {
                badgeService.desbloquear(duelo.getJugador2(), "primera_victoria_pvp");
            }
        } else {
            scoreJ1 = 0.5;
        }
        // Cargar con lock pesimista para garantizar exclusive access antes
        // de modificar ELO. Sin esto, el scheduler y un voto cerca de la ventana
        // de cierra podrian finalizar el mismo duelo concurrentemente.
        DueloLive locked = dueloRepository.findByIdForFinalize(duelo.getId())
                .orElseThrow(() -> new IllegalStateException("Duelo no encontrado: " + duelo.getId()));
        locked.setGanador(duelo.getGanador());
        aplicarEloYFinalizar(locked, scoreJ1, false);
    }

    /** Finaliza por abandono/walkover: el abandonador pierde, el rival gana. */
    public void finalizarWalkover(DueloLive duelo, Usuario abandonador, String reason) {
        // Idempotencia ANTES de mutar/emitir: si el duelo ya estaba finalizado
        // (p.ej. terminó normal por voto y llega un walkover tardío), no se debe
        // sobrescribir el ganador/abandonador ni re-emitir métrica+WS. El check
        // interno de aplicarEloYFinalizar solo protegía la aplicación de ELO.
        if (duelo.getFinishedEn() != null) {
            log.debug("finalizarWalkover: duelo={} ya estaba finalizado, skipping", duelo.getId());
            return;
        }
        boolean abandonadorEsJ1 = duelo.esJugador1(abandonador);
        duelo.setAbandonador(abandonador);
        duelo.setAbandonedEn(now());
        duelo.setGanador(abandonadorEsJ1 ? duelo.getJugador2() : duelo.getJugador1());
        aplicarEloYFinalizar(duelo, abandonadorEsJ1 ? 0.0 : 1.0, true);
        metrics.dueloLiveCompleted("walkover");
        notifier.emitirEstado(duelo, "OPPONENT_ABANDONED", "Walkover: " + reason);
    }

    private void aplicarEloYFinalizar(DueloLive duelo, double scoreJugador1, boolean walkover) {
        // Idempotencia: si finishedEn ya esta informado, el duelo fue procesado
        // en una llamada anterior a este metodo (scheduler o voto concurrente).
        if (duelo.getFinishedEn() != null) {
            log.debug("aplicarEloYFinalizar: duelo={} ya estaba finalizado, skipping", duelo.getId());
            return;
        }
        PvpEloService.PvpEloResult elo = pvpEloService.aplicarResultado(
                duelo.getJugador1(),
                duelo.getJugador2(),
                scoreJugador1,
                walkover);
        duelo.setJugador1EloBefore(elo.jugador1Before());
        duelo.setJugador2EloBefore(elo.jugador2Before());
        duelo.setJugador1EloAfter(elo.jugador1After());
        duelo.setJugador2EloAfter(elo.jugador2After());
        duelo.setEstado(walkover ? DueloLiveEstado.ABANDONED : DueloLiveEstado.FINISHED);
        duelo.setFinishedEn(now());
        usuarioRepository.save(duelo.getJugador1());
        if (duelo.getJugador2() != null) {
            usuarioRepository.save(duelo.getJugador2());
        }
        dueloRepository.save(duelo);
        // Drop de cartas (F1): unico choke-point de cierre. El listener
        // (AFTER_COMMIT) dropea moneda al ganador humano; ganador null
        // (bot o empate) no recompensa a nadie.
        Usuario ganador = duelo.getGanador();
        eventPublisher.publishEvent(new DueloLiveFinalizadoEvent(
                duelo.getId(), ganador != null ? ganador.getId() : null));
        String outcome = scoreJugador1 == 0.5 ? "draw" : (walkover ? "walkover" : "win");
        if (!walkover) metrics.dueloLiveCompleted(outcome);
        log.info("duelo_live_complete id={} outcome={} j1={} j2={} score={}-{} elo_delta_j1={} elo_delta_j2={} walkover={}",
                duelo.getId(),
                outcome,
                duelo.getJugador1().getUsername(),
                duelo.getJugador2() == null ? "BOT" : duelo.getJugador2().getUsername(),
                duelo.getScoreJugador1(),
                duelo.getScoreJugador2(),
                elo.jugador1Delta(),
                elo.jugador2Delta(),
                walkover);
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }
}
