package com.diegoalegil.animeshowdown.health;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Map;

import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Healthcheck custom del catálogo de personajes (Plan v2 §16.6/§16.10 +
 * auditoría P2.9 2026-05-17).
 *
 * <p>Detecta tres clases de incidente:
 * <ol>
 *   <li><b>BBDD vacía</b>: count &lt; 100 → DataSeeder no corrió o falló
 *       silenciosamente.</li>
 *   <li><b>Contaminación con variantes responsive</b>: count &gt; 1500 →
 *       las {@code -300/-600/-1024.webp} se trataron como personajes
 *       (incidente histórico 2026-05-17 con count 2815).</li>
 *   <li><b>Drift BBDD vs seed</b> (P2.9): el count en BBDD no coincide
 *       con el del archivo {@code personajes-seed.json}. Esto pasa
 *       cuando el seed se regenera (vía {@code sync-personajes.mjs}) pero
 *       el backend no se reinicia — el DataSeeder corre solo en boot.
 *       Status DEGRADED (no DOWN) porque el API sigue funcionando, pero
 *       hay diferencia entre lo "publicado" y lo que realmente sirve.</li>
 * </ol>
 *
 * <p>Expuesto en {@code /actuator/health} con la key {@code catalogo}.
 */
@Component("catalogo")
public class CatalogoHealthIndicator implements HealthIndicator {

    private static final long MIN_PERSONAJES_ESPERADO = 100;
    private static final long MAX_PERSONAJES_ESPERADO = 1500;
    private static final String SEED_FILE = "personajes-seed.json";

    private final PersonajeRepository personajeRepository;
    private final ObjectMapper objectMapper;

    public CatalogoHealthIndicator(PersonajeRepository personajeRepository,
            ObjectMapper objectMapper) {
        this.personajeRepository = personajeRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public Health health() {
        try {
            long count = personajeRepository.count();
            if (count < MIN_PERSONAJES_ESPERADO) {
                return Health.down()
                        .withDetail("personajes", count)
                        .withDetail("razon",
                                "Catálogo demasiado pequeño — DataSeeder no corrió?")
                        .withDetail("min_esperado", MIN_PERSONAJES_ESPERADO)
                        .build();
            }
            if (count > MAX_PERSONAJES_ESPERADO) {
                return Health.down()
                        .withDetail("personajes", count)
                        .withDetail("razon",
                                "Catálogo anormalmente grande — posible contaminación con variantes responsive")
                        .withDetail("max_esperado", MAX_PERSONAJES_ESPERADO)
                        .build();
            }
            // Audit P2.9: drift contra el seed file empaquetado.
            int seedCount = leerSeedCount();
            if (seedCount > 0 && seedCount != count) {
                // OUT_OF_SERVICE en vez de DOWN — el API funciona, pero
                // está sirviendo un catálogo distinto al que dice el seed.
                // En la práctica significa que falta un reboot tras un
                // resync. Visible en actuator/health pero no es 5xx.
                return Health.status("OUT_OF_SERVICE")
                        .withDetail("personajes_bbdd", count)
                        .withDetail("personajes_seed", seedCount)
                        .withDetail("razon",
                                "Drift entre BBDD y personajes-seed.json — reboot del backend para que DataSeeder sincronice")
                        .build();
            }
            return Health.up()
                    .withDetail("personajes", count)
                    .withDetail("seed", seedCount)
                    .build();
        } catch (Exception e) {
            return Health.down(e).build();
        }
    }

    /**
     * Lee el count de personajes del seed empaquetado. Devuelve 0 si no
     * se puede leer (el check de drift queda inactivo en ese caso, no
     * tira DOWN — preferimos no romper health por un error de I/O).
     */
    private int leerSeedCount() {
        try (InputStream is = new ClassPathResource(SEED_FILE).getInputStream()) {
            List<Map<String, Object>> seed = objectMapper.readValue(is, new TypeReference<>() {});
            return seed.size();
        } catch (IOException e) {
            return 0;
        }
    }
}
