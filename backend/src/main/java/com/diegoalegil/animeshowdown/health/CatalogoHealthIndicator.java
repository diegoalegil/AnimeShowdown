package com.diegoalegil.animeshowdown.health;

import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

import com.diegoalegil.animeshowdown.repository.PersonajeRepository;

/**
 * Healthcheck custom (Plan v2 §16.6/§16.10): verifica que el catálogo
 * de personajes esté presente y dentro del rango esperado.
 *
 * <p>Esto detecta dos clases de incidente:
 * <ol>
 *   <li>BBDD vacía (DataSeeder no corrió o falló silenciosamente).</li>
 *   <li>Catálogo contaminado por variantes responsive (count anormalmente
 *       alto, ej. 2815 cuando deberían ser ~730).</li>
 * </ol>
 *
 * <p>El umbral mínimo está hardcoded a 100 — un proyecto con menos de eso
 * sería un dev local recién migrado. El umbral máximo (1500) detecta la
 * contaminación clásica de variantes-como-personajes.
 *
 * <p>Expuesto en {@code /actuator/health} con la key {@code catalogo}.
 * UptimeRobot u otra herramienta de observabilidad puede gatillar alerta
 * si baja a DOWN.
 */
@Component("catalogo")
public class CatalogoHealthIndicator implements HealthIndicator {

    private static final long MIN_PERSONAJES_ESPERADO = 100;
    private static final long MAX_PERSONAJES_ESPERADO = 1500;

    private final PersonajeRepository personajeRepository;

    public CatalogoHealthIndicator(PersonajeRepository personajeRepository) {
        this.personajeRepository = personajeRepository;
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
            return Health.up()
                    .withDetail("personajes", count)
                    .build();
        } catch (Exception e) {
            return Health.down(e).build();
        }
    }
}
