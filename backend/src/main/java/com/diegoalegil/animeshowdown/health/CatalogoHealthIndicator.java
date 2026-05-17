package com.diegoalegil.animeshowdown.health;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Healthcheck custom del catálogo de personajes (Plan v2 §16.6/§16.10 +
 * auditorías P2.9 y P2 hardening 2026-05-17).
 *
 * <p>Detecta tres clases de incidente:
 * <ol>
 *   <li><b>BBDD vacía o anormalmente grande</b>: count fuera de
 *       [MIN, MAX] → DataSeeder no corrió, o contaminación con variantes
 *       responsive (incidente histórico 2026-05-17 con count 2815).
 *       Status DOWN.</li>
 *   <li><b>Drift BBDD vs seed por composición</b>: el set de slugs en BBDD
 *       difiere del set en {@code personajes-seed.json}, aunque coincidan
 *       en count. Antes del hardening solo comparábamos count y un drift
 *       de "1 slug fuera, 1 dentro" pasaba como UP. Status custom
 *       {@code DRIFT}.</li>
 *   <li><b>Drift por count</b>: misma situación, count distinto. También
 *       acaba en {@code DRIFT}.</li>
 * </ol>
 *
 * <p>{@code DRIFT} es un status custom propio (no estándar de Spring) que
 * se mapea explícitamente a HTTP 200 en {@code application.properties}
 * vía {@code management.endpoint.health.status.http-mapping.DRIFT=200}.
 * Razón: el API sigue funcionando con el catálogo que tiene en BBDD,
 * simplemente desvía de lo que dice el seed empaquetado. Devolver 503 a
 * Cloudflare/Railway healthcheck por esto provocaría restarts en bucle
 * que no resolverían el drift y harían fallar todos los demás endpoints.
 *
 * <p>Expuesto en {@code /actuator/health} con la key {@code catalogo}.
 * Antes el comentario decía "no es 5xx" pero el default de Spring Boot
 * SÍ mapea {@code OUT_OF_SERVICE} a 503 — el comentario era falso. El
 * fix usa un status propio + mapping explícito, no toca semántica
 * estándar.
 */
@Component("catalogo")
public class CatalogoHealthIndicator implements HealthIndicator {

    private static final long MIN_PERSONAJES_ESPERADO = 100;
    private static final long MAX_PERSONAJES_ESPERADO = 1500;
    private static final String SEED_FILE = "personajes-seed.json";

    /** Tope de slugs listados en cada lado del diff (evita responses gigantes). */
    private static final int MAX_DIFF_SAMPLES = 10;

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

            Set<String> seedSlugs = leerSeedSlugs();
            if (seedSlugs.isEmpty()) {
                // Sin seed no podemos comparar — UP con count visible, sin drift check.
                return Health.up()
                        .withDetail("personajes", count)
                        .withDetail("seed", "no disponible")
                        .build();
            }

            Set<String> bbddSlugs = new HashSet<>(personajeRepository.findAllSlugs());
            Set<String> missingFromBbdd = new HashSet<>(seedSlugs);
            missingFromBbdd.removeAll(bbddSlugs);
            Set<String> extraInBbdd = new HashSet<>(bbddSlugs);
            extraInBbdd.removeAll(seedSlugs);

            if (missingFromBbdd.isEmpty() && extraInBbdd.isEmpty()) {
                return Health.up()
                        .withDetail("personajes", count)
                        .withDetail("seed", seedSlugs.size())
                        .build();
            }

            return Health.status("DRIFT")
                    .withDetail("personajes_bbdd", bbddSlugs.size())
                    .withDetail("personajes_seed", seedSlugs.size())
                    .withDetail("ausentes_en_bbdd", sample(missingFromBbdd))
                    .withDetail("sobrantes_en_bbdd", sample(extraInBbdd))
                    .withDetail("razon",
                            "Drift composicional BBDD↔personajes-seed.json — reboot del backend para que DataSeeder sincronice")
                    .build();
        } catch (Exception e) {
            return Health.down(e).build();
        }
    }

    private Set<String> leerSeedSlugs() {
        try (InputStream is = new ClassPathResource(SEED_FILE).getInputStream()) {
            List<Map<String, Object>> seed = objectMapper.readValue(is, new TypeReference<>() {});
            Set<String> slugs = new HashSet<>(seed.size());
            for (Map<String, Object> entry : seed) {
                Object slug = entry.get("slug");
                if (slug != null) slugs.add(slug.toString());
            }
            return slugs;
        } catch (IOException e) {
            return Set.of();
        }
    }

    /**
     * Devuelve hasta MAX_DIFF_SAMPLES slugs ordenados de forma estable.
     * Si hay más, añade el conteo extra como pseudo-entrada al final.
     * Pensado para que el JSON de /actuator/health no crezca sin control
     * si la BBDD y el seed se desincronizan masivamente.
     */
    private List<String> sample(Set<String> slugs) {
        List<String> sorted = slugs.stream().sorted().toList();
        if (sorted.size() <= MAX_DIFF_SAMPLES) return sorted;
        List<String> truncated = new java.util.ArrayList<>(sorted.subList(0, MAX_DIFF_SAMPLES));
        truncated.add("... (+" + (sorted.size() - MAX_DIFF_SAMPLES) + " más)");
        return truncated;
    }
}
