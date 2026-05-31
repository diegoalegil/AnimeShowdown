package com.diegoalegil.animeshowdown.service;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.cache.annotation.Cacheable;
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
 * El render progresivo del bracket usa estos
 * tres campos para decidir qué rondas pintar con datos y cuáles difuminadas.
 */
@Service
public class TorneoQueryService {

    private static final Duration LIVE_MATCH_SLOT = Duration.ofMinutes(30);
    private static final String LEGACY_AUTO_DESC_PREFIX = "[AUTO]";
    private static final Pattern LEGACY_AUTO_SIZE =
            Pattern.compile(".*·\\s*(\\d+)\\s+personajes.*");

    private final TorneoRepository torneoRepository;
    private final EnfrentamientoRepository enfrentamientoRepository;
    private final VotoRepository votoRepository;
    private final Clock clock;

    public TorneoQueryService(
            TorneoRepository torneoRepository,
            EnfrentamientoRepository enfrentamientoRepository,
            VotoRepository votoRepository,
            Clock clock) {
        this.torneoRepository = torneoRepository;
        this.enfrentamientoRepository = enfrentamientoRepository;
        this.votoRepository = votoRepository;
        this.clock = clock;
    }

    /**
     * Listado público filtrado por visibilidad: solo torneos
     * NO_APLICA (admin legacy) o APROBADO (revisado). Los PENDIENTES y
     * RECHAZADOS no aparecen aquí — el creador los ve en /api/torneos/mios
     * y el admin en /api/admin/torneos/pendientes.
     */
    @Transactional(readOnly = true)
    @Cacheable(value = "torneos-resumen", key = "'publico'")
    public List<TorneoResumenDto> listarResumenes() {
        // antes esto era N+1 — toResumen() llamaba
        // findByTorneoOrderBy... por CADA torneo visible (1 + N queries
        // con N≈50 torneos). Ahora: 1 query de torneos + 1 query batch
        // de enfrentamientos (con JOIN FETCH de personajes) agrupada en
        // memoria. Reduce a 2 queries totales.
        List<Torneo> torneos = torneoRepository.findVisiblesPublico();
        if (torneos.isEmpty()) return List.of();
        List<Long> ids = torneos.stream().map(Torneo::getId).toList();
        List<Enfrentamiento> todos = enfrentamientoRepository.findByTorneoIdInOrdered(ids);
        Map<Long, Long> votos7d = new HashMap<>();
        LocalDateTime desde = LocalDateTime.now(clock).minusDays(7);
        for (Object[] row : votoRepository.contarVotosPorTorneoDesde(desde)) {
            votos7d.put((Long) row[0], (Long) row[1]);
        }
        Map<Long, List<Enfrentamiento>> porTorneo = new HashMap<>(torneos.size());
        for (Enfrentamiento e : todos) {
            porTorneo.computeIfAbsent(e.getTorneo().getId(), k -> new ArrayList<>()).add(e);
        }
        List<TorneoResumenDto> out = new ArrayList<>(torneos.size());
        for (Torneo t : torneos) {
            List<Enfrentamiento> matches = porTorneo.getOrDefault(t.getId(), List.of());
            TorneoResumenDto dto = rellenarResumen(new TorneoResumenDto(), t, matches);
            dto.setVotosUltimos7Dias(votos7d.getOrDefault(t.getId(), 0L));
            out.add(dto);
        }
        return out;
    }

    @Transactional(readOnly = true)
    public TorneoDetalleDto findBySlug(String slug) {
        Torneo torneo = torneoRepository.findBySlug(slug)
                .orElseThrow(() -> new EntityNotFoundException("Torneo no encontrado: slug=" + slug));
        if (torneo.getEstadoRevision() == EstadoRevision.PENDIENTE
                || torneo.getEstadoRevision() == EstadoRevision.RECHAZADO
                || !torneo.isPublico()) {
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
        // findBySlug filtra PENDIENTE/RECHAZADO pero
        // findById no lo hacía — un atacante que enumere ids consecutivos
        // podía leer torneos UGC en cola de moderación o rechazados. Mismo
        // 404 que si no existiera para no filtrar metadata del bracket.
        if (torneo.getEstadoRevision() == EstadoRevision.PENDIENTE
                || torneo.getEstadoRevision() == EstadoRevision.RECHAZADO
                || !torneo.isPublico()) {
            throw new EntityNotFoundException("Torneo no encontrado: id=" + id);
        }
        return toDetalle(torneo);
    }

    // --- mapping helpers ---

    private TorneoResumenDto toResumen(Torneo t) {
        List<Enfrentamiento> matches = enfrentamientoRepository.findByTorneoOrderedFetch(t);
        return rellenarResumen(new TorneoResumenDto(), t, matches);
    }

    private TorneoDetalleDto toDetalle(Torneo t) {
        List<Enfrentamiento> matches = enfrentamientoRepository.findByTorneoOrderedFetch(t);
        TorneoDetalleDto dto = new TorneoDetalleDto();
        rellenarResumen(dto, t, matches);

        // Bulk count de votos por match (evita N+1).
        Map<Long, Long> votosPorMatch = new HashMap<>();
        for (Object[] row : votoRepository.contarVotosPorEnfrentamientoDeTorneo(t.getId())) {
            votosPorMatch.put((Long) row[0], (Long) row[1]);
        }
        Map<Long, Map<Long, Long>> votosPorMatchPersonaje = new HashMap<>();
        for (Object[] row : votoRepository.contarVotosPorEnfrentamientoYPersonajeDeTorneo(t.getId())) {
            Long enfrentamientoId = (Long) row[0];
            Long personajeId = (Long) row[1];
            Long votos = (Long) row[2];
            votosPorMatchPersonaje
                    .computeIfAbsent(enfrentamientoId, ignored -> new HashMap<>())
                    .put(personajeId, votos);
        }

        List<EnfrentamientoDto> enfDtos = matches.stream()
                .map(e -> EnfrentamientoDto.from(
                        e,
                        votosPorMatch.getOrDefault(e.getId(), 0L),
                        votosDe(e, e.getPersonaje1(), votosPorMatchPersonaje),
                        votosDe(e, e.getPersonaje2(), votosPorMatchPersonaje)))
                .toList();
        dto.setEnfrentamientos(enfDtos);

        LocalDateTime serverNow = LocalDateTime.now(clock);
        Enfrentamiento current = calcularCurrentMatch(t.getEstado(), matches);
        dto.setLiveServerNow(serverNow);
        if (current != null) {
            dto.setCurrentMatch(EnfrentamientoDto.from(
                    current,
                    votosPorMatch.getOrDefault(current.getId(), 0L),
                    votosDe(current, current.getPersonaje1(), votosPorMatchPersonaje),
                    votosDe(current, current.getPersonaje2(), votosPorMatchPersonaje)));
            dto.setLiveEndsAt(calcularLiveEndsAt(t, serverNow));
        }
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
        dto.setDescripcion(descripcionPublica(t.getDescripcion()));
        dto.setEstado(t.getEstado());
        dto.setFechaCreacion(t.getFechaCreacion());
        dto.setFechaInicio(t.getFechaInicio());
        dto.setFechaFinalizacion(t.getFechaFinalizacion());
        dto.setPublico(t.isPublico());
        dto.setVotosUltimos7Dias(0L);

        int totalRondas = matches.stream().mapToInt(Enfrentamiento::getRonda).max().orElse(0);
        long matchesRonda1 = matches.stream().filter(m -> Integer.valueOf(1).equals(m.getRonda())).count();
        dto.setTotalRondas(totalRondas);
        dto.setNumParticipantes((int) (matchesRonda1 * 2));
        dto.setRondaActual(calcularRondaActual(t.getEstado(), totalRondas, matches));
        dto.setGanadorSlug(calcularGanadorSlug(t, totalRondas, matches));
        dto.setAvataresPrincipales(calcularAvataresPrincipales(matches));
        return dto;
    }

    private String descripcionPublica(String descripcion) {
        if (descripcion == null || !descripcion.startsWith(LEGACY_AUTO_DESC_PREFIX)) {
            return descripcion;
        }
        Matcher matcher = LEGACY_AUTO_SIZE.matcher(descripcion);
        String tamano = matcher.matches() ? matcher.group(1) : "8";
        return "Torneo automático de la comunidad con " + tamano
                + " personajes seleccionados al azar para mantener la arena activa.";
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

    private Enfrentamiento calcularCurrentMatch(EstadoTorneo estado, List<Enfrentamiento> matches) {
        if (estado != EstadoTorneo.IN_PROGRESS) {
            return null;
        }
        return matches.stream()
                .filter(m -> m.getPersonaje1() != null && m.getPersonaje2() != null && m.getGanador() == null)
                .min(Comparator
                        .comparing((Enfrentamiento m) -> m.getRonda() == null ? 1 : m.getRonda())
                        .thenComparing(m -> m.getId() == null ? Long.MAX_VALUE : m.getId()))
                .orElse(null);
    }

    private Long votosDe(Enfrentamiento e, Personaje p, Map<Long, Map<Long, Long>> votosPorMatchPersonaje) {
        if (e == null || p == null || e.getId() == null || p.getId() == null) {
            return null;
        }
        return votosPorMatchPersonaje
                .getOrDefault(e.getId(), Map.of())
                .getOrDefault(p.getId(), 0L);
    }

    private LocalDateTime calcularLiveEndsAt(Torneo torneo, LocalDateTime serverNow) {
        if (torneo.getFechaFinalizacion() != null && torneo.getFechaFinalizacion().isAfter(serverNow)) {
            return torneo.getFechaFinalizacion();
        }

        LocalDateTime anchor = torneo.getFechaInicio() != null
                ? torneo.getFechaInicio()
                : torneo.getFechaCreacion();
        if (anchor == null || anchor.isAfter(serverNow)) {
            return serverNow.plus(LIVE_MATCH_SLOT);
        }

        long slotSeconds = LIVE_MATCH_SLOT.toSeconds();
        long elapsedSeconds = Math.max(0, Duration.between(anchor, serverNow).getSeconds());
        long completedSlots = elapsedSeconds / slotSeconds;
        return anchor.plusSeconds((completedSlots + 1) * slotSeconds);
    }
}
