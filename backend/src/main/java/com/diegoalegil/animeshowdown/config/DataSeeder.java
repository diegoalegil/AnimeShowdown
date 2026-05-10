package com.diegoalegil.animeshowdown.config;

import java.io.InputStream;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Seeder idempotente: en cada arranque lee personajes-seed.json y SOLO inserta
 * los slugs que aún no existen en la BBDD. No trunca, no actualiza, no falla
 * si una fila concreta da error. Seguro de re-ejecutar en cualquier estado de
 * la BBDD (vacía, parcialmente seeded, completa).
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);
    private static final String SEED_FILE = "personajes-seed.json";

    private final PersonajeRepository personajeRepository;
    private final ObjectMapper objectMapper;

    public DataSeeder(PersonajeRepository personajeRepository, ObjectMapper objectMapper) {
        this.personajeRepository = personajeRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public void run(String... args) {
        log.info("DataSeeder iniciado: cargando {}", SEED_FILE);
        try (InputStream is = new ClassPathResource(SEED_FILE).getInputStream()) {
            List<SeedPersonaje> entradas = objectMapper.readValue(is, new TypeReference<>() {});

            Set<String> slugsExistentes = personajeRepository.findAll().stream()
                .map(Personaje::getSlug)
                .collect(Collectors.toSet());

            List<Personaje> nuevos = entradas.stream()
                .filter(s -> !slugsExistentes.contains(s.slug))
                .map(s -> new Personaje(
                    s.slug,
                    s.nombre,
                    s.anime,
                    s.descripcion,
                    s.imagenUrl != null ? s.imagenUrl : "/personajes/" + s.slug + ".webp"
                ))
                .toList();

            if (nuevos.isEmpty()) {
                log.info("DataSeeder: BBDD ya contiene los {} personajes del seed (entradas={}, existentes={})",
                    slugsExistentes.size(), entradas.size(), slugsExistentes.size());
                return;
            }

            personajeRepository.saveAll(nuevos);
            log.info("DataSeeder: insertados {} personajes nuevos (total ahora {} de {} en seed)",
                nuevos.size(),
                slugsExistentes.size() + nuevos.size(),
                entradas.size());
        } catch (Exception e) {
            log.error("DataSeeder fallo global al leer {}: {}", SEED_FILE, e.getMessage(), e);
        }
    }

    private static class SeedPersonaje {
        public String slug;
        public String nombre;
        public String anime;
        public String descripcion;
        public String imagenUrl;
    }
}
