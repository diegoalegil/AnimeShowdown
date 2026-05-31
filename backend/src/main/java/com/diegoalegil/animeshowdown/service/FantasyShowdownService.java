package com.diegoalegil.animeshowdown.service;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.FantasyDraftRequest;
import com.diegoalegil.animeshowdown.dto.FantasyEquipoDto;
import com.diegoalegil.animeshowdown.dto.FantasyEquipoItemDto;
import com.diegoalegil.animeshowdown.dto.FantasyLeaderboardEntryDto;
import com.diegoalegil.animeshowdown.dto.FantasyPersonajeDto;
import com.diegoalegil.animeshowdown.dto.FantasyResumenDto;
import com.diegoalegil.animeshowdown.dto.PersonajeScoreItem;
import com.diegoalegil.animeshowdown.model.FantasyEquipo;
import com.diegoalegil.animeshowdown.model.FantasyEquipoItem;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.FantasyEquipoRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

@Service
public class FantasyShowdownService {

    public static final int SLOTS = 5;
    public static final int PRESUPUESTO_DEFAULT = 1000;
    private static final int LIMIT_CANDIDATOS_DEFAULT = 80;
    private static final int LIMIT_CANDIDATOS_MAX = 300;
    private static final int ELO_BASE = 1500;

    private final FantasyEquipoRepository equipoRepository;
    private final PersonajeRepository personajeRepository;
    private final UsuarioRepository usuarioRepository;
    private final VotoRepository votoRepository;
    private final RankingMovimientosService rankingMovimientosService;
    private final Clock clock;
    private final int presupuesto;

    public FantasyShowdownService(
            FantasyEquipoRepository equipoRepository,
            PersonajeRepository personajeRepository,
            UsuarioRepository usuarioRepository,
            VotoRepository votoRepository,
            RankingMovimientosService rankingMovimientosService,
            Clock clock,
            @Value("${app.fantasy.presupuesto:" + PRESUPUESTO_DEFAULT + "}") int presupuesto) {
        this.equipoRepository = equipoRepository;
        this.personajeRepository = personajeRepository;
        this.usuarioRepository = usuarioRepository;
        this.votoRepository = votoRepository;
        this.rankingMovimientosService = rankingMovimientosService;
        this.clock = clock;
        this.presupuesto = Math.max(1, presupuesto);
    }

    @Transactional(readOnly = true)
    public FantasyResumenDto resumen(Usuario usuario) {
        String semanaIso = semanaIsoActual();
        FantasyEquipoDto equipo = equipoRepository.findByUsuarioAndSemanaIso(usuario, semanaIso)
                .map(this::toDto)
                .orElse(null);
        return new FantasyResumenDto(semanaIso, presupuesto, SLOTS, equipo);
    }

    @Transactional(readOnly = true)
    public List<FantasyPersonajeDto> candidatos(String query, int limit) {
        int saneLimit = Math.max(1, Math.min(LIMIT_CANDIDATOS_MAX,
                limit <= 0 ? LIMIT_CANDIDATOS_DEFAULT : limit));
        String q = query == null ? "" : query.trim();
        Map<Long, Long> votos = votosPorPersonaje();
        List<Personaje> personajes;
        if (q.isBlank()) {
            personajes = personajeRepository.topConPuntuacionYRecencia(
                            LocalDateTime.now(clock).minusDays(1),
                            PageRequest.of(0, saneLimit))
                    .stream()
                    .map(this::fromScoreItem)
                    .toList();
        } else {
            personajes = personajeRepository.buscarTexto(q).stream()
                    .sorted(Comparator
                            .comparingLong((Personaje p) -> votos.getOrDefault(p.getId(), 0L))
                            .reversed()
                            .thenComparing(Personaje::getNombre, String.CASE_INSENSITIVE_ORDER))
                    .limit(saneLimit)
                    .toList();
        }

        Map<Long, Integer> deltas = deltasSemanaActual(personajes.stream()
                .map(Personaje::getId)
                .toList());
        return personajes.stream()
                .map(p -> FantasyPersonajeDto.from(
                        p,
                        eloEstimado(votos.getOrDefault(p.getId(), 0L)),
                        costeDesdeVotos(votos.getOrDefault(p.getId(), 0L)),
                        deltas.getOrDefault(p.getId(), 0)))
                .toList();
    }

    @Transactional
    public FantasyEquipoDto guardarDraft(Usuario usuario, FantasyDraftRequest request) {
        List<Long> ids = sanePersonajeIds(request);
        String semanaIso = semanaIsoActual();
        FantasyEquipo equipo = obtenerOCrearEquipoDraft(usuario, semanaIso);
        if (equipo.isLocked()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El equipo de esta semana ya está bloqueado");
        }

        Map<Long, Personaje> personajes = personajesPorId(ids);
        Map<Long, Long> votos = votosPorPersonaje();
        List<FantasyEquipoItem> items = ids.stream()
                .map(id -> new FantasyEquipoItem(
                        personajes.get(id),
                        costeDesdeVotos(votos.getOrDefault(id, 0L))))
                .toList();
        int costeTotal = items.stream()
                .mapToInt(item -> item.getCoste() == null ? 0 : item.getCoste())
                .sum();
        if (costeTotal > presupuesto) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "El draft supera el presupuesto disponible");
        }

        equipo.reemplazarItems(items);
        equipo.setPuntos(0);
        equipo.setPuntosCalculadosAt(null);
        return toDto(equipoRepository.save(equipo));
    }

    private FantasyEquipo obtenerOCrearEquipoDraft(Usuario usuario, String semanaIso) {
        Optional<FantasyEquipo> existente = equipoRepository.findByUsuarioAndSemanaIsoForUpdate(usuario, semanaIso);
        if (existente.isPresent()) {
            return existente.get();
        }

        Usuario usuarioBloqueado = usuarioRepository.findForUpdateById(usuario.getId())
                .orElseThrow(() -> new IllegalStateException(
                        "Usuario no encontrado al crear equipo fantasy: " + usuario.getId()));
        return equipoRepository.findByUsuarioAndSemanaIsoForUpdate(usuarioBloqueado, semanaIso)
                .orElseGet(() -> new FantasyEquipo(usuarioBloqueado, semanaIso));
    }

    @Transactional
    public FantasyEquipoDto bloquearEquipo(Usuario usuario) {
        String semanaIso = semanaIsoActual();
        FantasyEquipo equipo = equipoRepository.findByUsuarioAndSemanaIsoForUpdate(usuario, semanaIso)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "No tienes equipo para esta semana"));
        if (equipo.getItems().size() != SLOTS) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "El equipo debe tener cinco personajes para bloquearse");
        }
        if (!equipo.isLocked()) {
            equipo.setLockedAt(LocalDateTime.now(clock));
        }
        return toDto(equipoRepository.save(equipo));
    }

    @Transactional(readOnly = true)
    public List<FantasyLeaderboardEntryDto> leaderboard(String semanaIso, int limit) {
        String semana = saneSemana(semanaIso);
        int saneLimit = Math.max(1, Math.min(100, limit <= 0 ? 50 : limit));
        List<FantasyEquipo> equipos = equipoRepository.findBySemanaIsoAndLockedAtIsNotNull(semana);
        Map<Long, Integer> deltas = deltasSemana(semana, equipos.stream()
                .flatMap(equipo -> equipo.getItems().stream())
                .map(item -> item.getPersonaje().getId())
                .toList());
        List<FantasyLeaderboardEntryDto> ordenados = equipos.stream()
                .map(equipo -> toLeaderboardEntry(0, equipo, deltas))
                .sorted(Comparator
                        .comparingInt(FantasyLeaderboardEntryDto::puntos).reversed()
                        .thenComparing(FantasyLeaderboardEntryDto::username, String.CASE_INSENSITIVE_ORDER))
                .limit(saneLimit)
                .toList();

        List<FantasyLeaderboardEntryDto> conPosicion = new ArrayList<>(ordenados.size());
        for (int i = 0; i < ordenados.size(); i++) {
            FantasyLeaderboardEntryDto entry = ordenados.get(i);
            conPosicion.add(new FantasyLeaderboardEntryDto(
                    i + 1,
                    entry.username(),
                    entry.avatarUrl(),
                    entry.puntos(),
                    entry.costeTotal(),
                    entry.items()));
        }
        return conPosicion;
    }

    @Transactional
    public int cerrarSemana(String semanaIso) {
        String semana = saneSemana(semanaIso);
        List<FantasyEquipo> equipos = equipoRepository.findBySemanaIsoAndLockedAtIsNotNull(semana);
        Map<Long, Integer> deltas = deltasSemana(semana, equipos.stream()
                .flatMap(equipo -> equipo.getItems().stream())
                .map(item -> item.getPersonaje().getId())
                .toList());
        LocalDateTime now = LocalDateTime.now(clock);
        for (FantasyEquipo equipo : equipos) {
            int puntos = puntosEquipo(equipo, deltas);
            equipo.setPuntos(puntos);
            equipo.setPuntosCalculadosAt(now);
            equipoRepository.save(equipo);
        }
        return equipos.size();
    }

    @Transactional
    public int bloquearEquiposSemana(String semanaIso) {
        String semana = saneSemana(semanaIso);
        LocalDateTime now = LocalDateTime.now(clock);
        int bloqueados = 0;
        for (FantasyEquipo equipo : equipoRepository.findBySemanaIso(semana)) {
            if (!equipo.isLocked() && equipo.getItems().size() == SLOTS) {
                equipo.setLockedAt(now);
                equipoRepository.save(equipo);
                bloqueados++;
            }
        }
        return bloqueados;
    }

    @Scheduled(cron = "${app.fantasy.weekly.cron:0 5 0 * * MON}", zone = "UTC")
    @Transactional
    public void cierreSemanalProgramado() {
        LocalDate hoy = LocalDate.now(clock);
        cerrarSemana(semanaIso(hoy.minusWeeks(1)));
        bloquearEquiposSemana(semanaIso(hoy));
    }

    public String semanaIsoActual() {
        return semanaIso(LocalDate.now(clock));
    }

    public static int costeDesdeVotos(long votos) {
        double votosSane = Math.max(0, votos);
        return Math.max(80, Math.min(420, 80 + (int) Math.round(Math.sqrt(votosSane) * 40.0)));
    }

    public static int eloEstimado(long votos) {
        long elo = ELO_BASE + Math.max(0, votos);
        return elo > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) elo;
    }

    private FantasyEquipoDto toDto(FantasyEquipo equipo) {
        Map<Long, Integer> deltas = deltasSemana(equipo.getSemanaIso(), equipo.getItems().stream()
                .map(item -> item.getPersonaje().getId())
                .toList());
        int costeTotal = costeTotal(equipo);
        int puntos = equipo.getPuntosCalculadosAt() != null
                ? nullSafe(equipo.getPuntos())
                : puntosEquipo(equipo, deltas);
        List<FantasyEquipoItemDto> items = equipo.getItems().stream()
                .map(item -> FantasyEquipoItemDto.from(
                        item,
                        deltas.getOrDefault(item.getPersonaje().getId(), 0)))
                .toList();
        return new FantasyEquipoDto(
                equipo.getId(),
                equipo.getSemanaIso(),
                equipo.isLocked(),
                equipo.getLockedAt(),
                presupuesto,
                costeTotal,
                presupuesto - costeTotal,
                puntos,
                equipo.getPuntosCalculadosAt(),
                items);
    }

    private FantasyLeaderboardEntryDto toLeaderboardEntry(
            int posicion,
            FantasyEquipo equipo,
            Map<Long, Integer> deltas) {
        List<FantasyEquipoItemDto> items = equipo.getItems().stream()
                .map(item -> FantasyEquipoItemDto.from(
                        item,
                        deltas.getOrDefault(item.getPersonaje().getId(), 0)))
                .toList();
        return new FantasyLeaderboardEntryDto(
                posicion,
                equipo.getUsuario().getUsername(),
                equipo.getUsuario().getAvatarUrl(),
                equipo.getPuntosCalculadosAt() != null
                        ? nullSafe(equipo.getPuntos())
                        : puntosEquipo(equipo, deltas),
                costeTotal(equipo),
                items);
    }

    private int puntosEquipo(FantasyEquipo equipo, Map<Long, Integer> deltas) {
        return equipo.getItems().stream()
                .mapToInt(item -> deltas.getOrDefault(item.getPersonaje().getId(), 0))
                .sum();
    }

    private int costeTotal(FantasyEquipo equipo) {
        return equipo.getItems().stream()
                .mapToInt(item -> item.getCoste() == null ? 0 : item.getCoste())
                .sum();
    }

    private List<Long> sanePersonajeIds(FantasyDraftRequest request) {
        List<Long> raw = request == null || request.personajeIds() == null
                ? List.of()
                : request.personajeIds();
        Set<Long> distinct = raw.stream()
                .filter(id -> id != null)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (distinct.size() != SLOTS || raw.size() != SLOTS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "El draft debe tener cinco personajes únicos");
        }
        return new ArrayList<>(distinct);
    }

    private Map<Long, Personaje> personajesPorId(List<Long> ids) {
        Map<Long, Personaje> personajes = personajeRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Personaje::getId, Function.identity()));
        if (personajes.size() != ids.size()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Algún personaje no existe");
        }
        return personajes;
    }

    private Map<Long, Long> votosPorPersonaje() {
        Map<Long, Long> votos = new LinkedHashMap<>();
        for (Object[] row : votoRepository.votosPorPersonajes()) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) continue;
            votos.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }
        return votos;
    }

    private Map<Long, Integer> deltasSemanaActual(List<Long> ids) {
        return deltasSemana(semanaIsoActual(), ids);
    }

    private Map<Long, Integer> deltasSemana(String semanaIso, List<Long> ids) {
        if (ids == null || ids.isEmpty()) return Map.of();
        LocalDate inicio = inicioSemana(semanaIso);
        LocalDateTime desde = inicio.atStartOfDay();
        LocalDateTime hasta = inicio.plusWeeks(1).atStartOfDay();
        LocalDateTime ahora = LocalDateTime.now(clock);
        if (hasta.isAfter(ahora)) hasta = ahora;
        if (!hasta.isAfter(desde)) return ids.stream()
                .filter(id -> id != null)
                .collect(Collectors.toMap(Function.identity(), id -> 0, (a, b) -> a));
        return rankingMovimientosService.calcularDeltasPosicion(ids, desde, hasta);
    }

    private Personaje fromScoreItem(PersonajeScoreItem item) {
        Personaje personaje = new Personaje();
        personaje.setId(item.id());
        personaje.setSlug(item.slug());
        personaje.setNombre(item.nombre());
        personaje.setAnime(item.anime());
        personaje.setImagenUrl(item.imagenUrl());
        return personaje;
    }

    private String saneSemana(String semanaIso) {
        if (semanaIso == null || semanaIso.isBlank()) return semanaIsoActual();
        return semanaIso.trim();
    }

    private static String semanaIso(LocalDate fecha) {
        WeekFields wf = WeekFields.ISO;
        int year = fecha.get(wf.weekBasedYear());
        int week = fecha.get(wf.weekOfWeekBasedYear());
        return "%04d-W%02d".formatted(year, week);
    }

    private static LocalDate inicioSemana(String semanaIso) {
        try {
            int year = Integer.parseInt(semanaIso.substring(0, 4));
            int week = Integer.parseInt(semanaIso.substring(6, 8));
            WeekFields wf = WeekFields.ISO;
            return LocalDate.of(year, 1, 4)
                    .with(wf.weekBasedYear(), year)
                    .with(wf.weekOfWeekBasedYear(), week)
                    .with(DayOfWeek.MONDAY);
        } catch (RuntimeException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "semanaIso inválida");
        }
    }

    private static int nullSafe(Integer value) {
        return value == null ? 0 : value;
    }
}
