package com.diegoalegil.animeshowdown.service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.EnfrentamientoDto;
import com.diegoalegil.animeshowdown.dto.TorneoDetalleDto;
import com.diegoalegil.animeshowdown.dto.TorneoResumenDto;
import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

import jakarta.persistence.EntityNotFoundException;

/**
 * Lectura de torneos en formato DTO para el frontend. Separado de
 * TorneoService (que gestiona escrituras) para mantener responsabilidades
 * limpias: aquí solo se mapea y agrega.
 *
 * Cálculos clave por torneo:
 *   - totalRondas: ronda máxima en los matches; 0 si bracket vacío.
 *   - numParticipantes: 2 × matches de ronda 1.
 *   - rondaActual: mínima ronda con un match jugable y sin ganador. Si
 *     todos los matches están resueltos, devuelve totalRondas (la final).
 *     Si el torneo está SCHEDULED, devuelve 1.
 *   - ganadorSlug: slug del ganador del match de la última ronda, solo
 *     si está FINISHED.
 *
 * El render progresivo del bracket (Plan v2 §1.1 + §17.1) usa estos
 * tres campos para decidir qué rondas pintar con datos y cuáles difuminadas.
 */
@Service
public class TorneoQueryService {

    private final TorneoRepository torneoRepository;
    private final EnfrentamientoRepository enfrentamientoRepository;
    private final VotoRepository votoRepository;

    public TorneoQueryService(
            TorneoRepository torneoRepository,
            EnfrentamientoRepository enfrentamientoRepository,
            VotoRepository votoRepository) {
        this.torneoRepository = torneoRepository;
        this.enfrentamientoRepository = enfrentamientoRepository;
        this.votoRepository = votoRepository;
    }

    @Transactional(readOnly = true)
    public List<TorneoResumenDto> listarResumenes() {
        return torneoRepository.findAll().stream()
                .map(this::toResumen)
                .toList();
    }

    @Transactional(readOnly = true)
    public TorneoDetalleDto findBySlug(String slug) {
        Torneo torneo = torneoRepository.findBySlug(slug)
                .orElseThrow(() -> new EntityNotFoundException("Torneo no encontrado: slug=" + slug));
        return toDetalle(torneo);
    }

    @Transactional(readOnly = true)
    public TorneoDetalleDto findById(Long id) {
        Torneo torneo = torneoRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Torneo no encontrado: id=" + id));
        return toDetalle(torneo);
    }

    // --- mapping helpers ---

    private TorneoResumenDto toResumen(Torneo t) {
        List<Enfrentamiento> matches = enfrentamientoRepository.findByTorneoOrderByRondaAscIdAsc(t);
        return rellenarResumen(new TorneoResumenDto(), t, matches);
    }

    private TorneoDetalleDto toDetalle(Torneo t) {
        List<Enfrentamiento> matches = enfrentamientoRepository.findByTorneoOrderByRondaAscIdAsc(t);
        TorneoDetalleDto dto = new TorneoDetalleDto();
        rellenarResumen(dto, t, matches);

        // Bulk count de votos por match (evita N+1).
        Map<Long, Long> votosPorMatch = new HashMap<>();
        for (Object[] row : votoRepository.contarVotosPorEnfrentamientoDeTorneo(t.getId())) {
            votosPorMatch.put((Long) row[0], (Long) row[1]);
        }

        List<EnfrentamientoDto> enfDtos = matches.stream()
                .map(e -> EnfrentamientoDto.from(e, votosPorMatch.getOrDefault(e.getId(), 0L)))
                .toList();
        dto.setEnfrentamientos(enfDtos);
        return dto;
    }

    /**
     * Rellena los campos comunes de TorneoResumenDto. Operación pura sin
     * I/O extra (matches ya viene como input).
     */
    private TorneoResumenDto rellenarResumen(TorneoResumenDto dto, Torneo t, List<Enfrentamiento> matches) {
        dto.setId(t.getId());
        dto.setSlug(t.getSlug());
        dto.setNombre(t.getNombre());
        dto.setDescripcion(t.getDescripcion());
        dto.setEstado(t.getEstado());
        dto.setFechaCreacion(t.getFechaCreacion());
        dto.setFechaInicio(t.getFechaInicio());
        dto.setFechaFinalizacion(t.getFechaFinalizacion());

        int totalRondas = matches.stream().mapToInt(Enfrentamiento::getRonda).max().orElse(0);
        long matchesRonda1 = matches.stream().filter(m -> Integer.valueOf(1).equals(m.getRonda())).count();
        dto.setTotalRondas(totalRondas);
        dto.setNumParticipantes((int) (matchesRonda1 * 2));
        dto.setRondaActual(calcularRondaActual(t.getEstado(), totalRondas, matches));
        dto.setGanadorSlug(calcularGanadorSlug(t.getEstado(), totalRondas, matches));
        return dto;
    }

    private Integer calcularRondaActual(EstadoTorneo estado, int totalRondas, List<Enfrentamiento> matches) {
        if (estado == EstadoTorneo.SCHEDULED) {
            return 1;
        }
        if (estado == EstadoTorneo.FINISHED) {
            return totalRondas;
        }
        // IN_PROGRESS: mínima ronda con match jugable (ambos personajes) sin ganador.
        return matches.stream()
                .filter(m -> m.getPersonaje1() != null && m.getPersonaje2() != null && m.getGanador() == null)
                .mapToInt(Enfrentamiento::getRonda)
                .min()
                .orElse(totalRondas); // todos resueltos → último round es el "actual" informativo
    }

    private String calcularGanadorSlug(EstadoTorneo estado, int totalRondas, List<Enfrentamiento> matches) {
        if (estado != EstadoTorneo.FINISHED || totalRondas == 0) {
            return null;
        }
        return matches.stream()
                .filter(m -> Integer.valueOf(totalRondas).equals(m.getRonda()))
                .filter(m -> m.getGanador() != null)
                .map(m -> m.getGanador().getSlug())
                .findFirst()
                .orElse(null);
    }
}
