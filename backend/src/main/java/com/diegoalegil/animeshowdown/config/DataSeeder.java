package com.diegoalegil.animeshowdown.config;

import java.io.InputStream;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

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
        long count = personajeRepository.count();
        if (count > 0) {
            log.info("DataSeeder omitido: ya hay {} personajes en BBDD", count);
            return;
        }

        log.info("DataSeeder iniciado: BBDD vacía, cargando {}", SEED_FILE);
        try (InputStream is = new ClassPathResource(SEED_FILE).getInputStream()) {
            List<SeedPersonaje> entradas = objectMapper.readValue(is, new TypeReference<>() {});
            List<Personaje> personajes = entradas.stream()
                .map(s -> new Personaje(
                    s.slug,
                    s.nombre,
                    s.anime,
                    s.descripcion,
                    s.imagenUrl != null ? s.imagenUrl : "/personajes/" + s.slug + ".webp"
                ))
                .toList();
            personajeRepository.saveAll(personajes);
            log.info("DataSeeder completado: {} personajes insertados", personajes.size());
        } catch (Exception e) {
            log.error("DataSeeder falló al leer {}: {}", SEED_FILE, e.getMessage(), e);
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
