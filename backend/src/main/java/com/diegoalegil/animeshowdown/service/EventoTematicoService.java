package com.diegoalegil.animeshowdown.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.EventoTematicoDto;
import com.diegoalegil.animeshowdown.dto.EventoTematicoRequest;
import com.diegoalegil.animeshowdown.model.EventoFiltroKind;
import com.diegoalegil.animeshowdown.model.EventoTematico;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.SlugUtil;
import com.diegoalegil.animeshowdown.repository.EventoTematicoRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;

import jakarta.persistence.EntityNotFoundException;

@Service
public class EventoTematicoService {

    private final EventoTematicoRepository eventoRepository;
    private final PersonajeRepository personajeRepository;
    private final Clock clock;

    public EventoTematicoService(
            EventoTematicoRepository eventoRepository,
            PersonajeRepository personajeRepository,
            Clock clock) {
        this.eventoRepository = eventoRepository;
        this.personajeRepository = personajeRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<EventoTematicoDto> listarPublicos() {
        return eventoRepository.findByActivoTrueOrderByInicioAsc()
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public Optional<EventoTematicoDto> buscarPublico(String slug) {
        return eventoRepository.findBySlug(slug)
                .filter(EventoTematico::isActivo)
                .map(this::toDto);
    }

    @Transactional(readOnly = true)
    public Optional<EventoTematico> buscarActivoParaCopa(String slug) {
        if (slug == null || slug.isBlank()) return Optional.empty();
        return eventoRepository.findBySlug(slug.trim())
                .filter(EventoTematico::isActivo)
                .filter(EventoTematico::isCupEnabled);
    }

    @Transactional(readOnly = true)
    public Optional<EventoTematico> eventoActivoParaCopa(LocalDateTime now) {
        return eventoRepository.findCopasActivas(now)
                .stream()
                .findFirst();
    }

    @Transactional(readOnly = true)
    public List<Personaje> seleccionarParticipantes(EventoTematico evento, int tamano) {
        List<Personaje> pool = participantes(evento);
        if (pool.size() <= tamano) return pool;
        LocalDate diaRotacion = LocalDateTime.now(clock).toLocalDate();
        pool.sort(Comparator
                .comparing((Personaje p) -> rotacion(evento.getSlug(), p.getSlug(), diaRotacion))
                .thenComparing(Personaje::getSlug));
        return pool.subList(0, tamano);
    }

    @Transactional
    public EventoTematicoDto crear(EventoTematicoRequest request) {
        EventoTematico evento = new EventoTematico();
        aplicarRequest(evento, request, true);
        if (eventoRepository.existsBySlug(evento.getSlug())) {
            throw new IllegalArgumentException("Ya existe un evento con slug " + evento.getSlug());
        }
        return toDto(eventoRepository.save(evento));
    }

    @Transactional
    public EventoTematicoDto actualizar(String slug, EventoTematicoRequest request) {
        EventoTematico evento = eventoRepository.findBySlug(slug)
                .orElseThrow(() -> new EntityNotFoundException("Evento no encontrado: " + slug));
        String slugAnterior = evento.getSlug();
        aplicarRequest(evento, request, false);
        if (!evento.getSlug().equals(slugAnterior) && eventoRepository.existsBySlug(evento.getSlug())) {
            throw new IllegalArgumentException("Ya existe un evento con slug " + evento.getSlug());
        }
        return toDto(eventoRepository.save(evento));
    }

    @Transactional
    public void desactivar(String slug) {
        EventoTematico evento = eventoRepository.findBySlug(slug)
                .orElseThrow(() -> new EntityNotFoundException("Evento no encontrado: " + slug));
        evento.setActivo(false);
        eventoRepository.save(evento);
    }

    public EventoTematicoDto toDto(EventoTematico evento) {
        Object valor = switch (evento.getFiltroKind()) {
            case ANIME, CATEGORIA -> valores(evento.getFiltroValor()).stream().findFirst().orElse("");
            case ANIMES, SLUGS -> valores(evento.getFiltroValor());
        };
        return new EventoTematicoDto(
                evento.getSlug(),
                evento.getTitulo(),
                evento.getDescripcionCorta(),
                new EventoTematicoDto.Tipo(kindCliente(evento.getFiltroKind()), valor),
                iso(evento.getInicio()),
                iso(evento.getFin()),
                evento.getColor(),
                evento.getEmoji(),
                new EventoTematicoDto.Cup(
                        evento.isCupEnabled(),
                        evento.getCupSize(),
                        cupNombre(evento)));
    }

    private List<Personaje> participantes(EventoTematico evento) {
        List<String> valores = valores(evento.getFiltroValor());
        return switch (evento.getFiltroKind()) {
            case ANIME -> valores.isEmpty()
                    ? List.of()
                    : personajeRepository.findByAnime(valores.get(0));
            case ANIMES -> personajeRepository.findByAnimeIn(valores);
            case SLUGS -> ordenarPorFiltro(personajeRepository.findBySlugIn(valores), valores);
            case CATEGORIA -> valores.isEmpty()
                    ? List.of()
                    : personajeRepository.findByCategoria(valores.get(0));
        };
    }

    private static List<Personaje> ordenarPorFiltro(List<Personaje> personajes, List<String> slugs) {
        Map<String, Integer> orden = new LinkedHashMap<>();
        for (int i = 0; i < slugs.size(); i++) orden.put(slugs.get(i), i);
        return personajes.stream()
                .sorted(Comparator.comparingInt((Personaje p) -> orden.getOrDefault(p.getSlug(), Integer.MAX_VALUE))
                        .thenComparing(Personaje::getSlug))
                .toList();
    }

    private static int rotacion(String eventoSlug, String personajeSlug, LocalDate dia) {
        return Math.abs((eventoSlug + ":" + personajeSlug + ":" + dia).hashCode());
    }

    private void aplicarRequest(EventoTematico evento, EventoTematicoRequest request, boolean crear) {
        if (request == null) throw new IllegalArgumentException("Body requerido");
        String titulo = requerido(request.titulo(), "titulo");
        String slug = request.slug();
        if (crear || slug != null) {
            evento.setSlug(slug == null || slug.isBlank() ? SlugUtil.slugify(titulo) : SlugUtil.slugify(slug));
        }
        evento.setTitulo(titulo);
        evento.setDescripcionCorta(requerido(request.descripcionCorta(), "descripcionCorta"));
        EventoFiltroKind kind = normalizarKind(request.tipo());
        evento.setFiltroKind(kind);
        evento.setFiltroValor(normalizarValor(kind, request.tipo().valor()));
        evento.setInicio(parseFecha(request.inicioISO(), "inicioISO"));
        evento.setFin(parseFecha(request.finISO(), "finISO"));
        if (!evento.getFin().isAfter(evento.getInicio())) {
            throw new IllegalArgumentException("finISO debe ser posterior a inicioISO");
        }
        evento.setColor(valorO(request.color(), "amber"));
        evento.setEmoji(valorO(request.emoji(), "*"));
        evento.setActivo(request.activo() == null || request.activo());
        EventoTematicoRequest.Cup cup = request.cup();
        evento.setCupEnabled(cup == null || cup.enabled() == null || cup.enabled());
        int tamano = cup == null || cup.tamano() == null ? 8 : cup.tamano();
        if (tamano != 8 && tamano != 16) {
            throw new IllegalArgumentException("cup.tamano debe ser 8 o 16");
        }
        evento.setCupSize(tamano);
        evento.setCupNombre(cup == null ? null : cup.nombre());
        aplicarRecompensa(evento, request.recompensa());
    }

    /**
     * Aplica la config de recompensas si viene en el request. En update, omitir
     * el bloque deja intactas las recompensas ya guardadas (no las borra).
     */
    private void aplicarRecompensa(EventoTematico evento, EventoTematicoRequest.Recompensa recompensa) {
        if (recompensa == null) {
            return;
        }
        if (recompensa.moneda() != null) {
            evento.setRecompensaMoneda(Math.max(0, recompensa.moneda()));
        }
        if (recompensa.cartaEspecialSlug() != null) {
            evento.setRecompensaCartaEspecialSlug(normalizarOpcional(recompensa.cartaEspecialSlug()));
        }
        if (recompensa.badgeCodigo() != null) {
            evento.setRecompensaBadgeCodigo(normalizarOpcional(recompensa.badgeCodigo()));
        }
        if (recompensa.sobreGratis() != null) {
            evento.setRecompensaSobreGratis(recompensa.sobreGratis());
        }
    }

    /** Trim; cadena vacía ⇒ null (borra la config de ese campo). */
    private static String normalizarOpcional(String valor) {
        String limpio = valor.trim();
        return limpio.isEmpty() ? null : limpio;
    }

    private static EventoFiltroKind normalizarKind(EventoTematicoRequest.Tipo tipo) {
        if (tipo == null || tipo.kind() == null || tipo.kind().isBlank()) {
            throw new IllegalArgumentException("tipo.kind requerido");
        }
        return switch (tipo.kind().trim().toLowerCase(Locale.ROOT)) {
            case "anime" -> EventoFiltroKind.ANIME;
            case "animes" -> EventoFiltroKind.ANIMES;
            case "slugs" -> EventoFiltroKind.SLUGS;
            case "categoria" -> EventoFiltroKind.CATEGORIA;
            default -> throw new IllegalArgumentException("tipo.kind no soportado: " + tipo.kind());
        };
    }

    private static String normalizarValor(EventoFiltroKind kind, Object raw) {
        List<String> valores = valoresDesde(raw);
        if (valores.isEmpty()) throw new IllegalArgumentException("tipo.valor requerido");
        if ((kind == EventoFiltroKind.ANIME || kind == EventoFiltroKind.CATEGORIA)
                && valores.size() > 1) {
            throw new IllegalArgumentException("tipo.valor para anime/categoria debe ser un string");
        }
        return String.join(",", valores);
    }

    private static List<String> valoresDesde(Object raw) {
        if (raw instanceof String s) return valores(s);
        if (raw instanceof Collection<?> collection) {
            List<String> out = new ArrayList<>();
            for (Object item : collection) {
                if (item != null && !item.toString().isBlank()) out.add(item.toString().trim());
            }
            return out;
        }
        return List.of();
    }

    private static List<String> valores(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        List<String> out = new ArrayList<>();
        for (String part : csv.split(",")) {
            String value = part.trim();
            if (!value.isEmpty()) out.add(value);
        }
        return out;
    }

    private static String kindCliente(EventoFiltroKind kind) {
        return switch (kind) {
            case ANIME -> "anime";
            case ANIMES -> "animes";
            case SLUGS -> "slugs";
            case CATEGORIA -> "categoria";
        };
    }

    private static String iso(LocalDateTime dateTime) {
        return dateTime.atOffset(ZoneOffset.UTC).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
    }

    private static LocalDateTime parseFecha(String value, String field) {
        String raw = requerido(value, field);
        try {
            return OffsetDateTime.parse(raw).withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime();
        } catch (RuntimeException ignored) {
            return LocalDateTime.parse(raw);
        }
    }

    private static String cupNombre(EventoTematico evento) {
        String configured = evento.getCupNombre();
        return configured == null || configured.isBlank()
                ? evento.getTitulo()
                : configured.trim();
    }

    private static String requerido(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " requerido");
        }
        return value.trim();
    }

    private static String valorO(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
