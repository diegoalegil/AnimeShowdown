package com.diegoalegil.animeshowdown.service;

import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Siembra el ELO-semilla del catálogo a partir de los datos de AniList
 * (género + favourites) generados offline por
 * {@code scripts/data/backfill-anilist-genero.mjs} y commiteados en
 * {@code personajes-anilist.json}.
 *
 * <p>Para cada personaje: rellena {@code genero} y {@code popularidadFuente} si
 * están vacíos (no pisa correcciones manuales) y SIEMPRE recalcula
 * {@code eloSemilla = EloSemillaCalculator.calcular(popularidadFuente, genero)}
 * con los parámetros configurables. Sin popularidad → semilla null (cold-start,
 * el ranking usará el suelo). Idempotente: solo persiste si algo cambia.
 *
 * <p>Lo invoca {@code DataSeeder} tras sincronizar el catálogo. Es best-effort:
 * la semilla no es crítica para servir el API (hasta activar el ranking
 * canónico, nada la lee para ordenar), así que un fallo no rompe el arranque.
 */
@Service
public class EloSemillaInitializeService {

    private static final Logger log = LoggerFactory.getLogger(EloSemillaInitializeService.class);
    private static final String ANILIST_FILE = "personajes-anilist.json";

    private final PersonajeRepository personajeRepository;
    private final ObjectMapper objectMapper;
    private final EloSemillaCalculator.Params params;

    public EloSemillaInitializeService(
            PersonajeRepository personajeRepository,
            ObjectMapper objectMapper,
            @Value("${app.ranking.elo-semilla.factor:120}") double factor,
            @Value("${app.ranking.elo-semilla.floor:1500}") int floor,
            @Value("${app.ranking.elo-semilla.ceiling:1900}") int ceiling,
            @Value("${app.ranking.elo-semilla.bonus-femenino:1.15}") double bonusFemenino) {
        this.personajeRepository = personajeRepository;
        this.objectMapper = objectMapper;
        this.params = new EloSemillaCalculator.Params(factor, floor, ceiling, bonusFemenino);
    }

    @Transactional
    public int inicializar() {
        Map<String, DatoAnilist> datos = cargar();
        if (datos.isEmpty()) {
            log.info("EloSemilla: {} no encontrado o vacío; nada que sembrar", ANILIST_FILE);
            return 0;
        }
        List<Personaje> personajes = personajeRepository.findAll();
        int cambios = 0;
        for (Personaje p : personajes) {
            if (aplicar(p, datos.get(p.getSlug()))) {
                personajeRepository.save(p);
                cambios++;
            }
        }
        log.info("EloSemilla: {} personajes actualizados (datos AniList={})", cambios, datos.size());
        return cambios;
    }

    /**
     * Aplica los datos de AniList a un personaje: rellena género/popularidad si
     * están vacíos (no pisa correcciones manuales) y recalcula la semilla.
     * Devuelve true si cambió algo. {@code d} puede ser null (sin match): solo
     * recalcula la semilla desde lo que ya tenga el personaje.
     */
    boolean aplicar(Personaje p, DatoAnilist d) {
        boolean dirty = false;
        if (d != null) {
            if (p.getGenero() == null && d.genero() != null && !d.genero().isBlank()) {
                p.setGenero(d.genero());
                dirty = true;
            }
            if (p.getPopularidadFuente() == null && d.favourites() != null && d.favourites() > 0) {
                p.setPopularidadFuente(d.favourites());
                dirty = true;
            }
        }
        Integer nuevaSemilla = p.getPopularidadFuente() != null
                ? EloSemillaCalculator.calcular(p.getPopularidadFuente(), p.getGenero(), params)
                : null;
        if (!Objects.equals(p.getEloSemilla(), nuevaSemilla)) {
            p.setEloSemilla(nuevaSemilla);
            dirty = true;
        }
        return dirty;
    }

    private Map<String, DatoAnilist> cargar() {
        ClassPathResource resource = new ClassPathResource(ANILIST_FILE);
        if (!resource.exists()) {
            return Map.of();
        }
        try (InputStream is = resource.getInputStream()) {
            return objectMapper.readValue(is, new TypeReference<Map<String, DatoAnilist>>() {});
        } catch (Exception e) {
            log.warn("EloSemilla: no se pudo leer {}: {}", ANILIST_FILE, e.getMessage());
            return Map.of();
        }
    }

    /** Entrada de personajes-anilist.json. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DatoAnilist(String genero, Integer favourites, String anilistName, Boolean animeMatch) {}
}
