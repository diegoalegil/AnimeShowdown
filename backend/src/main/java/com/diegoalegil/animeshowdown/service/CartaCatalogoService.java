package com.diegoalegil.animeshowdown.service;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.model.Carta;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.RarezaCarta;
import com.diegoalegil.animeshowdown.repository.CartaRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Siembra el catálogo de cartas desde el de personajes: 1 carta SSR por
 * personaje (regla del owner). Idempotente — sólo crea las que faltan, así que
 * correr en cada arranque sólo cubre los personajes nuevos.
 *
 * <p>No se hace en una migración Flyway porque los personajes se importan en
 * runtime (DataSeeder desde personajes-seed.json), no existen en tiempo de
 * migración. DataSeeder llama a {@link #sincronizarDesdePersonajes()} al final
 * de su sync, garantizando que los personajes ya estén en BBDD.
 *
 * <p>Las cartas ESPECIAL NO se siembran: son arte curado por el owner que se
 * añadirá puntualmente (premio/evento), no derivable del catálogo de personajes.
 */
@Service
public class CartaCatalogoService {

    private static final Logger log = LoggerFactory.getLogger(CartaCatalogoService.class);

    private final PersonajeRepository personajeRepository;
    private final CartaRepository cartaRepository;
    private final ObjectMapper objectMapper;

    public CartaCatalogoService(PersonajeRepository personajeRepository, CartaRepository cartaRepository,
            ObjectMapper objectMapper) {
        this.personajeRepository = personajeRepository;
        this.cartaRepository = cartaRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * Crea la carta SSR que falte para cada personaje. Devuelve cuántas creó.
     * Hace el diff en memoria (un query de ids existentes) para no lanzar un
     * exists por personaje en catálogos de cientos.
     */
    @Transactional
    @CacheEvict(value = "cartas-catalogo", allEntries = true)
    public int sincronizarDesdePersonajes() {
        List<Personaje> personajes = personajeRepository.findAll();
        Set<Long> conCartaSsr = new HashSet<>(
                cartaRepository.findPersonajeIdsByRareza(RarezaCarta.SSR));

        List<Carta> nuevas = new ArrayList<>();
        for (Personaje p : personajes) {
            if (!conCartaSsr.contains(p.getId())) {
                nuevas.add(new Carta(p, RarezaCarta.SSR));
            }
        }
        if (!nuevas.isEmpty()) {
            cartaRepository.saveAll(nuevas);
        }
        log.info("CartaCatalogoService: catálogo sincronizado — cartas SSR creadas={} (personajes={}, ya existían={})",
                nuevas.size(), personajes.size(), conCartaSsr.size());
        return nuevas.size();
    }

    /**
     * Sincroniza las ESPECIAL curadas desde un manifiesto pequeño. Los PNG no se
     * suben; el manifiesto apunta al WebP optimizado que sirve el frontend.
     */
    @Transactional
    @CacheEvict(value = "cartas-catalogo", allEntries = true)
    public int sincronizarEspecialesCuradas() {
        List<CartaEspecialSeed> seeds = leerEspeciales();
        int tocadas = 0;
        for (CartaEspecialSeed seed : seeds) {
            String variante = seed.variante() != null ? seed.variante() : "";
            Personaje personaje = personajeRepository.findBySlug(seed.slug()).orElse(null);
            if (personaje == null) {
                log.warn("Carta especial omitida: slug={} no existe en personajes", seed.slug());
                continue;
            }
            Carta carta = cartaRepository
                    .findByPersonajeSlugAndRarezaAndVariante(seed.slug(), RarezaCarta.ESPECIAL, variante)
                    .orElseGet(() -> {
                        Carta nueva = new Carta(personaje, RarezaCarta.ESPECIAL);
                        nueva.setVariante(variante);
                        return nueva;
                    });
            carta.setPersonaje(personaje);
            carta.setEspecialCurada(true);
            carta.setArteUrl(seed.arteUrl());
            carta.setVariante(variante);
            cartaRepository.save(carta);
            tocadas++;
        }
        log.info("CartaCatalogoService: especiales sincronizadas={} (manifest={})",
                tocadas, seeds.size());
        return tocadas;
    }

    private List<CartaEspecialSeed> leerEspeciales() {
        ClassPathResource resource = new ClassPathResource("cartas-especiales.json");
        if (!resource.exists()) {
            return List.of();
        }
        try (InputStream is = resource.getInputStream()) {
            return objectMapper.readValue(is, new TypeReference<>() {});
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo leer cartas-especiales.json: " + e.getMessage(), e);
        }
    }

    private record CartaEspecialSeed(String slug, String variante, String arteUrl) {
    }
}
