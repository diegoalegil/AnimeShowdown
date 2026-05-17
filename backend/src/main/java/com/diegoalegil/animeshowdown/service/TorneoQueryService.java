package com.diegoalegil.animeshowdown.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.EnfrentamientoDto;
import com.diegoalegil.animeshowdown.dto.PersonajeMiniDto;
import com.diegoalegil.animeshowdown.dto.TorneoDetalleDto;
import com.diegoalegil.animeshowdown.dto.TorneoResumenDto;
import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.EstadoRevision;
import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.Personaje;
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

    /**
     * Listado público filtrado por visibilidad (Plan v2 §4.9): solo torneos
     * NO_APLICA (admin legacy) o APROBADO (revisado). Los PENDIENTES y
     * RECHAZADOS no aparecen aquí — el creador los ve en /api/torneos/mios
     * y el admin en /api/admin/torneos/pendientes.
     */
    @Transactional(readOnly = true)
    public List<TorneoResumenDto> listarResumenes() {
        return torneoRepository.findVisiblesPublico().stream()
                .map(this::toResumen)
                .toList();
    }

    @Transactional(readOnly = true)
    public TorneoDetalleDto findBySlug(String slug) {
        Torneo torneo = torneoRepository.findBySlug(slug)
                .orElseThrow(() -> new EntityNotFoundException("Torneo no encontrado: slug=" + slug));
        if (torneo.getEstadoRevision() == EstadoRevision.PENDIENTE
                || torneo.getEstadoRevision() == EstadoRevision.RECHAZADO) {
            // Slug existe pero el torneo no es visible al público — mismo
            // 404 que si no existiera, para no filtrar metadatos del bracket
            // pendiente a usuarios no autorizados.
            throw new EntityNotFoundException("Torneo no encontrado: slug=" + slug);
        }
        return toDetalle(torneo);
    }

    @Transactional(readOnly = true)
    public TorneoDetalleDto findById(Long id) {
        Torneo torneo = torneoRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Torneo no encontrado: id=" + id));
        // Audit P2 (2026-05-17): findBySlug filtra PENDIENTE/RECHAZADO pero
        // findById no lo hacía — un atacante que enumere ids consecutivos
        // podía leer torneos UGC en cola de moderación o rechazados. Mismo
        // 404 que si no existiera para no filtrar metadata del bracket.
        if (torneo.getEstadoRevision() == EstadoRevision.PENDIENTE
                || torneo.getEstadoRevision() == EstadoRevision.RECHAZADO) {
            throw new EntityNotFoundException("Torneo no encontrado: id=" + id);
        }
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
        dto.setGanadorSlug(calcularGanadorSlug(t, totalRondas, matches));
        dto.setAvataresPrincipales(calcularAvataresPrincipales(matches));
        return dto;
    }

    /**
     * Primeros 5 personajes únicos de los matches de ronda 1, en orden de
     * inserción. Si la ronda 1 tiene menos, devuelve lo que haya. Sirve al
     * frontend para pintar el circulito de avatares en el listado sin
     * pedir el detalle de cada torneo.
     */
    private List<PersonajeMiniDto> calcularAvataresPrincipales(List<Enfrentamiento> matches) {
        List<PersonajeMiniDto> avatares = new ArrayList<>();
        for (Enfrentamiento m : matches) {
            if (!Integer.valueOf(1).equals(m.getRonda())) continue;
            agregarAvatar(avatares, m.getPersonaje1());
            agregarAvatar(avatares, m.getPersonaje2());
            if (avatares.size() >= 5) break;
        }
        return avatares;
    }

    private void agregarAvatar(List<PersonajeMiniDto> avatares, Personaje p) {
        if (p == null || avatares.size() >= 5) return;
        avatares.add(PersonajeMiniDto.from(p));
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

    /**
     * Determina el slug del ganador del torneo con dos fuentes:
     *
     *   1. Torneo.ganadorPersonaje directo (campo añadido en commit 6 para
     *      torneos legacy seedados con ganador conocido pero sin bracket
     *      intermedio detallado).
     *   2. Fallback: ganador del match de la última ronda en BBDD, cuando
     *      el bracket se ha cerrado a través del flujo normal.
     *
     * Solo retorna no-null si el torneo está FINISHED.
     */
    private String calcularGanadorSlug(Torneo t, int totalRondas, List<Enfrentamiento> matches) {
        if (t.getEstado() != EstadoTorneo.FINISHED) {
            return null;
        }
        if (t.getGanadorPersonaje() != null) {
            return t.getGanadorPersonaje().getSlug();
        }
        if (totalRondas == 0) {
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
