package com.diegoalegil.animeshowdown.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.model.Carta;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.RarezaCarta;
import com.diegoalegil.animeshowdown.repository.CartaRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;

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

    public CartaCatalogoService(PersonajeRepository personajeRepository, CartaRepository cartaRepository) {
        this.personajeRepository = personajeRepository;
        this.cartaRepository = cartaRepository;
    }

    /**
     * Crea la carta SSR que falte para cada personaje. Devuelve cuántas creó.
     * Hace el diff en memoria (un query de ids existentes) para no lanzar un
     * exists por personaje en catálogos de cientos.
     */
    @Transactional
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
}
