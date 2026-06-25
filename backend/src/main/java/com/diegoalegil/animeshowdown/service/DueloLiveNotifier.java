package com.diegoalegil.animeshowdown.service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.diegoalegil.animeshowdown.dto.DueloLiveRoundDto;
import com.diegoalegil.animeshowdown.dto.DueloLiveStateDto;
import com.diegoalegil.animeshowdown.model.DueloLive;
import com.diegoalegil.animeshowdown.model.DueloLiveEstado;
import com.diegoalegil.animeshowdown.model.DueloLiveRonda;
import com.diegoalegil.animeshowdown.model.DueloLiveRondaEstado;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.DueloLiveRepository;
import com.diegoalegil.animeshowdown.repository.DueloLiveRondaRepository;

/**
 * Presentación del duelo live: construye el {@link DueloLiveStateDto} para un
 * participante y lo emite por WebSocket a las colas privadas de los jugadores.
 *
 * <p>Extraído de {@code DueloLiveService} (split de mantenibilidad): es lógica
 * de SOLO LECTURA (no muta estado ni toma locks), así que se ejecuta dentro de
 * la transacción del llamador sin cambiar su semántica. Comportamiento idéntico
 * al original.
 */
@Component
public class DueloLiveNotifier {

    private final DueloLiveRepository dueloRepository;
    private final DueloLiveRondaRepository rondaRepository;
    private final SimpMessagingTemplate messaging;
    private final Clock clock;
    private final int fallbackAfterSeconds;

    public DueloLiveNotifier(DueloLiveRepository dueloRepository,
            DueloLiveRondaRepository rondaRepository,
            SimpMessagingTemplate messaging,
            Clock clock,
            @Value("${app.duelo-live.fallback-after-seconds:5}")
            int fallbackAfterSeconds) {
        this.dueloRepository = dueloRepository;
        this.rondaRepository = rondaRepository;
        this.messaging = messaging;
        this.clock = clock;
        this.fallbackAfterSeconds = Math.max(3, fallbackAfterSeconds);
    }

    public DueloLiveStateDto estadoPara(DueloLive duelo, Usuario usuario, String event, String message) {
        boolean soyJ1 = duelo.esJugador1(usuario);
        DueloLiveRonda activa = rondaRepository
                .findTopByDueloAndEstadoOrderByNumeroDesc(duelo, DueloLiveRondaEstado.IN_PROGRESS)
                .orElseGet(() -> rondaRepository.findByDueloIdDetalleDesc(duelo.getId()).stream().findFirst().orElse(null));
        int queuePosition = 0;
        if (duelo.getEstado() == DueloLiveEstado.WAITING) {
            List<DueloLive> esperando = dueloRepository.findWaitingOrderByCreadoEn();
            for (int i = 0; i < esperando.size(); i++) {
                if (esperando.get(i).getId().equals(duelo.getId())) {
                    queuePosition = i + 1;
                    break;
                }
            }
        }
        return DueloLiveStateDto.from(
                duelo,
                DueloLiveRoundDto.from(activa, now(), soyJ1),
                now(),
                soyJ1,
                queuePosition,
                fallbackAfterSeconds,
                event,
                message);
    }

    public void emitirEstado(DueloLive duelo, String event, String message) {
        // Construye los payloads AHORA (sesión abierta → sin LazyInit sobre las
        // asociaciones del duelo) pero ENVÍALOS tras el commit. Emitir dentro de la
        // tx del scheduler/voto arriesga una transición fantasma (MATCH_FOUND /
        // ROUND_END / MATCH_END): si la tx hace rollback después, el cliente ya
        // habría recibido por WS un cambio de estado que la BBDD nunca persistió.
        // Si no hay tx activa (llamada fuera de @Transactional), envía directo.
        List<Runnable> envios = new ArrayList<>(2);
        if (duelo.getJugador1() != null) {
            String username = duelo.getJugador1().getUsername();
            DueloLiveStateDto dto = estadoPara(duelo, duelo.getJugador1(), event, message);
            envios.add(() -> messaging.convertAndSendToUser(username, "/queue/duelo", dto));
        }
        if (duelo.getJugador2() != null) {
            String username = duelo.getJugador2().getUsername();
            DueloLiveStateDto dto = estadoPara(duelo, duelo.getJugador2(), event, message);
            envios.add(() -> messaging.convertAndSendToUser(username, "/queue/duelo", dto));
        }
        enviarTrasCommit(envios);
    }

    /**
     * Envía los WS ya construidos tras el commit de la tx activa (preservando el
     * orden de registro); si no hay sincronización de tx activa, envía directo.
     */
    private void enviarTrasCommit(List<Runnable> envios) {
        if (envios.isEmpty()) {
            return;
        }
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    envios.forEach(Runnable::run);
                }
            });
        } else {
            envios.forEach(Runnable::run);
        }
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }
}
