package com.diegoalegil.animeshowdown.service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

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
        if (duelo.getJugador1() != null) {
            messaging.convertAndSendToUser(duelo.getJugador1().getUsername(), "/queue/duelo",
                    estadoPara(duelo, duelo.getJugador1(), event, message));
        }
        if (duelo.getJugador2() != null) {
            messaging.convertAndSendToUser(duelo.getJugador2().getUsername(), "/queue/duelo",
                    estadoPara(duelo, duelo.getJugador2(), event, message));
        }
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }
}
