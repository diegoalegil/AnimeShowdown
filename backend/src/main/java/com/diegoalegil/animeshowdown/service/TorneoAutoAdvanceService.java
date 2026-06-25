package com.diegoalegil.animeshowdown.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

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
    private final EventoRecompensaService eventoRecompensaService;
    private final TorneoOperacionLockService torneoOperacionLockService;
    private final SimpMessagingTemplate messaging;
    private final CacheManager cacheManager;

    public TorneoAutoAdvanceService(
            TorneoRepository torneoRepository,
            BracketAdvanceService bracketAdvanceService,
            PrediccionService prediccionService,
            NotificacionService notificacionService,
            EventoRecompensaService eventoRecompensaService,
            TorneoOperacionLockService torneoOperacionLockService,
            CacheManager cacheManager,
            @Autowired(required = false) SimpMessagingTemplate messaging) {
        this.torneoRepository = torneoRepository;
        this.bracketAdvanceService = bracketAdvanceService;
        this.prediccionService = prediccionService;
        this.notificacionService = notificacionService;
        this.eventoRecompensaService = eventoRecompensaService;
        this.torneoOperacionLockService = torneoOperacionLockService;
        this.cacheManager = cacheManager;
        this.messaging = messaging;
    }

    /**
     * Cierra/avanza rondas elegibles de un torneo en curso.
     *
     * <p>Toma el lock de operación por torneo ANTES de leer el estado, de modo
     * que el chequeo "¿hay ronda cerrable?" y el avance sean atómicos frente a
     * {@code PrediccionService.aplicar} y {@code resolverParaTorneo}, que usan
     * el mismo lock. Sin esto, una predicción podía leer el enfrentamiento sin
     * cerrojo justo mientras el auto-avance le fijaba el ganador (TOCTOU).
     */
    @Transactional
    public BracketAdvanceService.Resultado avanzarSiProcede(Long torneoId, String reason) {
        if (!torneoRepository.existsById(torneoId)) {
            return BracketAdvanceService.Resultado.SIN_CAMBIOS;
        }
        torneoOperacionLockService.lock(torneoId);

        Torneo torneo = torneoRepository.findById(torneoId).orElse(null);
        if (torneo == null || torneo.getEstado() != EstadoTorneo.IN_PROGRESS) {
            return BracketAdvanceService.Resultado.SIN_CAMBIOS;
        }
        // La Arena (V66) es un torneo-sistema sin bracket: sus duelos se resuelven
        // por umbral de votos en ArenaService, no por rondas. Nunca se "avanza".
        if (torneo.isEsArena()) {
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

        // Invalida los cachés que este cambio de bracket dejó obsoletos. El auto-
        // avance (scheduler + on-vote) NO pasaba por los @CacheEvict de los paths
        // manuales de TorneoService, así que el listado público (torneos-resumen,
        // TTL 30s) quedaba viejo hasta expirar y —al finalizar— la OG image
        // (og-torneo, TTL 7 DÍAS) seguía mostrando el bracket sin campeón. Se
        // evicta TRAS el commit para que una lectura concurrente no recachee el
        // estado viejo en la ventana previa al commit (crítico con el TTL de 7d).
        evictTrasCommit(resultado == BracketAdvanceService.Resultado.TORNEO_FINALIZADO
                ? new String[] {"torneos-resumen", "og-torneo"}
                : new String[] {"torneos-resumen"});

        if (resultado == BracketAdvanceService.Resultado.TORNEO_FINALIZADO) {
            int resueltas = prediccionService.resolverParaTorneo(actualizado);
            repartirRecompensasEvento(actualizado);
            notificarTorneoFinalizado(actualizado);
            log.info("Torneo {} auto-finalizado por {}: {} predicciones resueltas",
                    torneoId, reason, resueltas);
        } else {
            log.info("Torneo {} auto-avanzado por {}", torneoId, reason);
        }
        return resultado;
    }

    /** Limpia los cachés nombrados tras el commit de la tx activa (o ya, si no hay). */
    private void evictTrasCommit(String... caches) {
        Runnable evict = () -> {
            for (String nombre : caches) {
                Cache cache = cacheManager.getCache(nombre);
                if (cache != null) {
                    cache.clear();
                }
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    evict.run();
                }
            });
        } else {
            evict.run();
        }
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

    private void repartirRecompensasEvento(Torneo torneo) {
        try {
            eventoRecompensaService.repartirPorTorneoFinalizado(torneo);
        } catch (Exception e) {
            log.warn("Reparto de recompensas de evento falló: torneo={} err={}",
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
