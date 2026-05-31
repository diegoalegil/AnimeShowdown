package com.diegoalegil.animeshowdown.service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.VotosPeriodoDto;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

import jakarta.persistence.EntityNotFoundException;

/**
 * Calcula la actividad reciente de votos por personaje.
 *
 * <p>Una ventana actual ({@code now - dias} .. {@code now}) y una
 * inmediatamente anterior ({@code now - 2·dias} .. {@code now - dias}).
 * Delta = actual - anterior. Sin manipular el ELO base — son sólo
 * votos absolutos en periodo.
 *
 * <p>{@code dias} se acota cliente-side (controller) entre 1 y 90.
 */
@Service
public class VotosPeriodoService {

    private final VotoRepository votoRepository;
    private final PersonajeRepository personajeRepository;

    public VotosPeriodoService(VotoRepository votoRepository,
            PersonajeRepository personajeRepository) {
        this.votoRepository = votoRepository;
        this.personajeRepository = personajeRepository;
    }

    /**
     * Devuelve la actividad de un slug concreto. 404 propaga como
     * {@link EntityNotFoundException} para que el controller la mapee.
     * Si el personaje no tiene votos, devuelve ceros (no error).
     */
    @Transactional(readOnly = true)
    public VotosPeriodoDto calcularSlug(String slug, int dias) {
        Personaje p = personajeRepository.findBySlug(slug)
                .orElseThrow(() -> new EntityNotFoundException(
                        "Personaje no encontrado: " + slug));
        LocalDateTime ahora = LocalDateTime.now();
        LocalDateTime inicioActual = ahora.minusDays(dias);
        LocalDateTime inicioAnterior = ahora.minusDays(2L * dias);
        double actual = votoRepository.countByPersonajeIdInRange(p.getId(), inicioActual, ahora);
        double anterior = votoRepository.countByPersonajeIdInRange(p.getId(), inicioAnterior, inicioActual);
        return new VotosPeriodoDto(slug, actual, anterior, actual - anterior, dias, inicioActual, inicioAnterior);
    }

    /**
     * Versión batch: devuelve un mapa {slug → VotosPeriodoDto} para
     * todos los slugs solicitados, ejecutando solo 2 queries SQL
     * (una por ventana). Los slugs inexistentes se omiten del mapa
     * silenciosamente — el caller decide si quiere fallar.
     *
     * <p>Pensado para Pulso/Movers/Favoritos: en lugar de N requests
     * individuales, una sola request batch devuelve toda la info.
     */
    @Transactional(readOnly = true)
    public List<VotosPeriodoDto> calcularBatch(List<String> slugs, int dias) {
        if (slugs.isEmpty()) return List.of();
        List<Personaje> personajes = personajeRepository.findBySlugIn(slugs);
        if (personajes.isEmpty()) return List.of();
        // map slug -> Personaje para mantener orden y rellenar slugs ausentes.
        Map<String, Personaje> bySlug = new HashMap<>();
        for (Personaje p : personajes) bySlug.put(p.getSlug(), p);

        LocalDateTime ahora = LocalDateTime.now();
        LocalDateTime inicioActual = ahora.minusDays(dias);
        LocalDateTime inicioAnterior = ahora.minusDays(2L * dias);
        List<Long> ids = personajes.stream().map(Personaje::getId).toList();
        Map<Long, Double> actualByPid = aMap(votoRepository.countByPersonajeIdsInRange(ids, inicioActual, ahora));
        Map<Long, Double> anteriorByPid = aMap(votoRepository.countByPersonajeIdsInRange(ids, inicioAnterior, inicioActual));

        return slugs.stream()
                .map((slug) -> {
                    Personaje p = bySlug.get(slug);
                    if (p == null) return null;
                    double actual = actualByPid.getOrDefault(p.getId(), 0.0);
                    double anterior = anteriorByPid.getOrDefault(p.getId(), 0.0);
                    return new VotosPeriodoDto(slug, actual, anterior, actual - anterior, dias, inicioActual, inicioAnterior);
                })
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    private static Map<Long, Double> aMap(List<Object[]> filas) {
        Map<Long, Double> m = new HashMap<>();
        for (Object[] r : filas) m.put((Long) r[0], ((Number) r[1]).doubleValue());
        return m;
    }
}
