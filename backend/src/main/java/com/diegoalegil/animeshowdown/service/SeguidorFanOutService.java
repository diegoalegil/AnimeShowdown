package com.diegoalegil.animeshowdown.service;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.diegoalegil.animeshowdown.model.NotificacionTipo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.SeguidorRepository;

/**
 * Fan-out de notificaciones a los seguidores de un actor (B7 §3). Aislado para
 * que BadgeService/TorneoService no repitan el loop.
 *
 * <p>Reglas: solo lo invocan eventos de BAJA frecuencia y ALTA señal —logro
 * desbloqueado y torneo aprobado—; NUNCA los votos (alta frecuencia → spam).
 * Es best-effort (no propaga excepciones, nunca debe romper el evento que lo
 * dispara) y está acotado a {@link #MAX_FANOUT} seguidores por evento para que
 * un perfil muy seguido no genere un pico de escrituras.
 */
@Service
public class SeguidorFanOutService {

    private static final Logger log = LoggerFactory.getLogger(SeguidorFanOutService.class);

    /** Tope de seguidores notificados por evento. */
    static final int MAX_FANOUT = 500;

    private final SeguidorRepository seguidorRepository;
    private final NotificacionService notificacionService;

    public SeguidorFanOutService(SeguidorRepository seguidorRepository,
            NotificacionService notificacionService) {
        this.seguidorRepository = seguidorRepository;
        this.notificacionService = notificacionService;
    }

    /**
     * Notifica a los seguidores del actor. Devuelve cuántas notificaciones se
     * crearon. No lanza: cualquier fallo se loguea y se sigue.
     */
    public int notificarSeguidores(Usuario actor, NotificacionTipo tipo,
            String titulo, String mensaje, String payload) {
        if (actor == null) return 0;
        List<Usuario> seguidores;
        try {
            seguidores = seguidorRepository.seguidoresDe(actor);
        } catch (Exception e) {
            log.warn("Fan-out {}: no se pudieron cargar seguidores de {}: {}",
                    tipo, actor.getUsername(), e.getMessage());
            return 0;
        }
        int enviadas = 0;
        for (Usuario seguidor : seguidores) {
            if (enviadas >= MAX_FANOUT) {
                log.warn("Fan-out {} truncado a {} de {} seguidores (actor={})",
                        tipo, MAX_FANOUT, seguidores.size(), actor.getUsername());
                break;
            }
            try {
                notificacionService.crear(seguidor, tipo, titulo, mensaje, payload);
                enviadas++;
            } catch (Exception e) {
                log.warn("Fan-out {} a {} falló: {}", tipo, seguidor.getUsername(), e.getMessage());
            }
        }
        return enviadas;
    }
}
