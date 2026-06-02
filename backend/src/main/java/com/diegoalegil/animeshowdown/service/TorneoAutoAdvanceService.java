package com.diegoalegil.animeshowdown.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import com.diegoalegil.animeshowdown.dto.TorneoBracketChangedEvent;
import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;

@Service
public class TorneoAutoAdvanceService {

    private static final Logger log = LoggerFactory.getLogger(TorneoAutoAdvanceService.class);

    private final TorneoRepository torneoRepository;
    private final BracketAdvanceService bracketAdvanceService;
    private final PrediccionService prediccionService;
    private final NotificacionService notificacionService;
    private final SimpMessagingTemplate messaging;

    public TorneoAutoAdvanceService(
            TorneoRepository torneoRepository,
            BracketAdvanceService bracketAdvanceService,
            PrediccionService prediccionService,
            NotificacionService notificacionService,
            @Autowired(required = false) SimpMessagingTemplate messaging) {
        this.torneoRepository = torneoRepository;
        this.bracketAdvanceService = bracketAdvanceService;
        this.prediccionService = prediccionService;
        this.notificacionService = notificacionService;
        this.messaging = messaging;
    }

    public BracketAdvanceService.Resultado avanzarSiProcede(Long torneoId, String reason) {
        Torneo torneo = torneoRepository.findById(torneoId).orElse(null);
        if (torneo == null || torneo.getEstado() != EstadoTorneo.IN_PROGRESS) {
            return BracketAdvanceService.Resultado.SIN_CAMBIOS;
        }

        BracketAdvanceService.Resultado resultado = "vote".equals(reason)
                ? bracketAdvanceService.cerrarRondasIntermedias(torneo)
                : bracketAdvanceService.cerrarTodasLasRondas(torneo);
        if (resultado == BracketAdvanceService.Resultado.SIN_CAMBIOS) {
            return resultado;
        }

        Torneo actualizado = torneoRepository.findById(torneoId).orElse(torneo);
        publicarBracketChanged(actualizado, reason);

        if (resultado == BracketAdvanceService.Resultado.TORNEO_FINALIZADO) {
            int resueltas = prediccionService.resolverParaTorneo(actualizado);
            notificarTorneoFinalizado(actualizado);
            log.info("Torneo {} auto-finalizado por {}: {} predicciones resueltas",
                    torneoId, reason, resueltas);
        } else {
            log.info("Torneo {} auto-avanzado por {}", torneoId, reason);
        }
        return resultado;
    }

    private void publicarBracketChanged(Torneo torneo, String reason) {
        if (messaging == null) return;
        var event = new TorneoBracketChangedEvent(
                torneo.getId(),
                torneo.getSlug(),
                torneo.getEstado() == null ? null : torneo.getEstado().name(),
                reason);
        try {
            messaging.convertAndSend("/topic/torneo." + torneo.getId() + ".bracket", event);
            if (torneo.getSlug() != null && !torneo.getSlug().isBlank()) {
                messaging.convertAndSend("/topic/tournament/" + torneo.getSlug(), event);
            }
        } catch (Exception e) {
            log.warn("Push WS auto-advance falló: torneo={} err={}",
                    torneo.getId(), e.getMessage());
        }
    }

    private void notificarTorneoFinalizado(Torneo torneo) {
        try {
            notificacionService.notificarTorneoFinalizadoATodos(torneo);
        } catch (Exception e) {
            log.warn("Fan-out de torneo finalizado falló: torneo={} err={}",
                    torneo.getId(), e.getMessage());
        }
    }
}
