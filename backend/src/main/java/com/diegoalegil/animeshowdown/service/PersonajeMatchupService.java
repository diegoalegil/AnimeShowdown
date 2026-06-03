package com.diegoalegil.animeshowdown.service;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import com.diegoalegil.animeshowdown.dto.DueloRecienteDto;
import com.diegoalegil.animeshowdown.dto.MatchupResumenDto;
import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;

import jakarta.persistence.EntityNotFoundException;

/**
 * Agrega "contra quién gana / pierde / se enfrenta más" de un personaje
 * a partir de su historial de enfrentamientos decididos. In-memory
 * porque las queries SQL para esto serían más enrevesadas que el grupo
 * client-side y los volúmenes son pequeños (cientos por personaje top
 * en este proyecto, muy lejos de un BattleNet).
 *
 * <p>Consumido por
 * {@code /api/personajes/{slug}/matchups} para pintar la sección
 * "Contra quién" en la ficha de personaje.
 */
@Service
public class PersonajeMatchupService {

    private final PersonajeRepository personajeRepository;
    private final EnfrentamientoRepository enfrentamientoRepository;

    public PersonajeMatchupService(PersonajeRepository personajeRepository,
            EnfrentamientoRepository enfrentamientoRepository) {
        this.personajeRepository = personajeRepository;
        this.enfrentamientoRepository = enfrentamientoRepository;
    }

    @Cacheable(value = "personaje-matchups", key = "#slug")
    public MatchupResumenDto calcular(String slug) {
        Personaje yo = personajeRepository.findBySlug(slug)
                .orElseThrow(() -> new EntityNotFoundException(
                        "Personaje no encontrado: " + slug));

        List<Enfrentamiento> decididos =
                enfrentamientoRepository.findDecididosPorPersonaje(yo.getId());

        if (decididos.isEmpty()) {
            return new MatchupResumenDto(0L, List.of(), List.of(), List.of());
        }

        // Map<rivalId, [rival, wins, losses]> — acumulamos por rival concreto.
        // Usamos el id del personaje como key para evitar quirks con equals/hashCode
        // de JPA entities; el Personaje rival se guarda como valor.
        Map<Long, Acumulador> porRival = new HashMap<>();
        for (Enfrentamiento e : decididos) {
            Personaje rival = esYo(e.getPersonaje1(), yo) ? e.getPersonaje2() : e.getPersonaje1();
            // Defensivo: si por corrupción de datos el rival es null o
            // soy yo mismo (no debería pasar), salta el item.
            if (rival == null || rival.getId() == null || rival.getId().equals(yo.getId())) {
                continue;
            }
            Acumulador acc = porRival.computeIfAbsent(rival.getId(), k -> new Acumulador(rival));
            if (esYo(e.getGanador(), yo)) acc.wins++;
            else acc.losses++;
        }

        List<MatchupResumenDto.MatchupItem> items = porRival.values().stream()
                .map(Acumulador::toItem)
                .toList();

        return new MatchupResumenDto(
                decididos.size(),
                topPor(items, Comparator.comparingInt(MatchupResumenDto.MatchupItem::wins).reversed()),
                topPor(items, Comparator.comparingInt(MatchupResumenDto.MatchupItem::losses).reversed()),
                topPor(items, Comparator.comparingInt(MatchupResumenDto.MatchupItem::total).reversed()));
    }

    private static List<MatchupResumenDto.MatchupItem> topPor(
            List<MatchupResumenDto.MatchupItem> items,
            Comparator<MatchupResumenDto.MatchupItem> orden) {
        return items.stream()
                .sorted(orden)
                .limit(3)
                .toList();
    }

    private static boolean esYo(Personaje p, Personaje yo) {
        return p != null && p.getId() != null && p.getId().equals(yo.getId());
    }

    private static final class Acumulador {
        final Personaje rival;
        int wins;
        int losses;

        Acumulador(Personaje rival) {
            this.rival = rival;
        }

        MatchupResumenDto.MatchupItem toItem() {
            return new MatchupResumenDto.MatchupItem(
                    DueloRecienteDto.PersonajeMini.from(rival),
                    wins,
                    losses);
        }
    }
}
