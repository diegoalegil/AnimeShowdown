package com.diegoalegil.animeshowdown.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;

/**
 * Genera torneos aleatorios automáticamente.
 * Usado por el endpoint admin POST /api/admin/torneos/auto-generar y por el
 * GitHub Action `auto-tournament.yml` que lo invoca cada 3 días.
 *
 * Idempotencia: si en las últimas 24h ya se generó un torneo automático, devuelve
 * el existente con flag yaExistia=true. Para forzar uno nuevo pasa force=true.
 */
@Service
public class TorneoAutoService {

    private static final Logger log = LoggerFactory.getLogger(TorneoAutoService.class);
    private static final String AUTO_NAME_PREFIX = "Random Showdown #";
    private static final int VENTANA_HORAS = 24;

    private final TorneoRepository torneoRepository;
    private final PersonajeRepository personajeRepository;
    private final BracketService bracketService;
    private final IndexNowService indexNowService;
    private final NotificacionService notificacionService;
    private final boolean enabled;

    public TorneoAutoService(
            TorneoRepository torneoRepository,
            PersonajeRepository personajeRepository,
            BracketService bracketService,
            IndexNowService indexNowService,
            NotificacionService notificacionService,
            @Value("${app.tournament.auto.enabled:true}") boolean enabled) {
        this.torneoRepository = torneoRepository;
        this.personajeRepository = personajeRepository;
        this.bracketService = bracketService;
        this.indexNowService = indexNowService;
        this.notificacionService = notificacionService;
        this.enabled = enabled;
        log.info("TorneoAutoService inicializado: enabled={}", enabled);
    }

    public boolean isEnabled() {
        return enabled;
    }

    public Optional<Torneo> torneoAutoReciente() {
        LocalDateTime ventana = LocalDateTime.now().minusHours(VENTANA_HORAS);
        return torneoRepository.findTorneoMasRecientePorNombrePrefixDesde(AUTO_NAME_PREFIX, ventana);
    }

    /**
     * Crea un torneo aleatorio con N personajes (8 o 16) emparejados secuencialmente
     * en bracket. Lo deja en estado IN_PROGRESS con sus enfrentamientos creados.
     *
     * @return el torneo guardado y con enfrentamientos persistidos.
     */
    @Transactional
    @CacheEvict(value = "torneos-resumen", allEntries = true)
    public Torneo generar(int tamano, boolean force) {
        if (!enabled) {
            throw new IllegalStateException("Auto-generación de torneos deshabilitada (app.tournament.auto.enabled=false)");
        }
        if (tamano != 8 && tamano != 16) {
            throw new IllegalArgumentException("Tamaño debe ser 8 o 16, recibido: " + tamano);
        }

        if (!force) {
            Optional<Torneo> reciente = torneoAutoReciente();
            if (reciente.isPresent()) {
                throw new IdempotenciaException(
                        "Ya hay un torneo auto en las últimas " + VENTANA_HORAS + "h",
                        reciente.get());
            }
        }

        List<Personaje> seleccionados = personajeRepository.findRandom(tamano);
        if (seleccionados.size() < tamano) {
            throw new IllegalStateException(
                    "BBDD tiene " + seleccionados.size() + " personajes, insuficientes para torneo de " + tamano);
        }

        long autoCount = torneoRepository.countByNombrePrefix(AUTO_NAME_PREFIX) + 1;
        String nombre = AUTO_NAME_PREFIX + autoCount;
        // Slug determinista por contador (siempre incrementa con countByNombrePrefix),
        // así no necesitamos iterar para garantizar unicidad como TorneoService.crear.
        String slug = "random-showdown-" + autoCount;
        Torneo torneo = new Torneo(
                slug,
                nombre,
                "Torneo automático de la comunidad con " + tamano
                        + " personajes seleccionados al azar para mantener la arena activa.");
        torneo.setEstado(EstadoTorneo.IN_PROGRESS);
        torneo.setFechaInicio(LocalDateTime.now());
        Torneo guardado = torneoRepository.save(torneo);

        // Antes solo creaba la 1ª ronda (8 enfrentamientos para tamaño 16).
        // Ahora BracketService crea las rondas en cascada: octavos con
        // personajes, cuartos/semis/final con slots vacíos hasta que el
        // scheduler de avance (commit 4.5) o el admin cierren las rondas.
        List<Enfrentamiento> enfs = bracketService.crearBracket(guardado, seleccionados);

        log.info("Auto-torneo {} creado (id={}, tamaño={}, matches_totales={}, slugs={})",
                guardado.getNombre(),
                guardado.getId(),
                tamano,
                enfs.size(),
                seleccionados.stream().map(Personaje::getSlug).toList());

        // 7 + SEO duelos (2026-05-19): IndexNow ping para que
        // el nuevo torneo y sus landings /duelos/A-vs-B se descubran en
        // Bing/Yandex en minutos. Async + best-effort; no afecta al cron
        // si falla.
        indexNowService.notificar(indexNowUrlsParaTorneo(guardado, seleccionados));
        try {
            notificacionService.notificarTorneoDisponibleATodos(guardado);
        } catch (Exception e) {
            log.warn("Fan-out de torneo auto disponible falló: torneo={} err={}",
                    guardado.getId(), e.getMessage());
        }

        return guardado;
    }

    private static List<String> indexNowUrlsParaTorneo(Torneo torneo, List<Personaje> participantes) {
        List<String> rutas = new ArrayList<>();
        rutas.add("/torneos/" + torneo.getSlug());
        for (int i = 0; i < participantes.size(); i++) {
            for (int j = i + 1; j < participantes.size(); j++) {
                rutas.add("/duelos/%s-vs-%s".formatted(
                        participantes.get(i).getSlug(),
                        participantes.get(j).getSlug()));
            }
        }
        return rutas;
    }

    /**
     * Excepción para idempotencia 24h. Lleva el torneo existente para que el
     * controller pueda devolverlo en el body del 409.
     */
    public static class IdempotenciaException extends RuntimeException {
        private final Torneo existente;

        public IdempotenciaException(String mensaje, Torneo existente) {
            super(mensaje);
            this.existente = existente;
        }

        public Torneo getExistente() {
            return existente;
        }
    }
}
