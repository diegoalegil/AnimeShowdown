package com.diegoalegil.animeshowdown.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.EnfrentamientoCrearRequest;
import com.diegoalegil.animeshowdown.dto.TorneoCrearMioRequest;
import com.diegoalegil.animeshowdown.dto.TorneoCrearRequest;
import com.diegoalegil.animeshowdown.dto.TorneoIniciarRequest;
import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.EstadoRevision;
import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.SlugUtil;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

import jakarta.persistence.EntityNotFoundException;

/**
 * Lógica de negocio de torneos. Antes vivía en TorneoController mezclada con
 * la capa HTTP (ResponseEntity, status codes, validación de inputs) — ahora
 * el controller solo orquesta HTTP y delega aquí.
 *
 * Las violaciones de regla de negocio se lanzan como IllegalStateException
 * (mapeado a 409 por GlobalExceptionHandler) o IllegalArgumentException (400).
 * EntityNotFoundException → 404.
 */
@Service
public class TorneoService {

    private static final Logger log = LoggerFactory.getLogger(TorneoService.class);

    private final TorneoRepository torneoRepository;
    private final EnfrentamientoRepository enfrentamientoRepository;
    private final PersonajeRepository personajeRepository;
    private final VotoRepository votoRepository;
    private final BracketService bracketService;
    private final PrediccionService prediccionService;

    public TorneoService(
            TorneoRepository torneoRepository,
            EnfrentamientoRepository enfrentamientoRepository,
            PersonajeRepository personajeRepository,
            VotoRepository votoRepository,
            BracketService bracketService,
            PrediccionService prediccionService) {
        this.torneoRepository = torneoRepository;
        this.enfrentamientoRepository = enfrentamientoRepository;
        this.personajeRepository = personajeRepository;
        this.votoRepository = votoRepository;
        this.bracketService = bracketService;
        this.prediccionService = prediccionService;
    }

    public Torneo crear(TorneoCrearRequest request) {
        String slug = generarSlugUnico(request.getNombre());
        Torneo torneo = new Torneo(slug, request.getNombre(), request.getDescripcion());
        return torneoRepository.save(torneo);
    }

    /**
     * Crea un torneo a partir de un usuario verificado (Plan v2 §4.9).
     *
     * <p>Diferencias vs {@link #crear(TorneoCrearRequest)}:
     * <ul>
     *   <li>Nace con {@code estadoRevision=PENDIENTE} — no visible en
     *       listado público hasta que admin lo apruebe.</li>
     *   <li>Estado de torneo queda en SCHEDULED. El bracket se precomputa
     *       AHORA con los personajes elegidos, pero el match no empieza
     *       hasta la aprobación (el admin inicia automáticamente al
     *       aprobar — sub-bloque C).</li>
     *   <li>Tamaño estricto: 8 o 16 participantes para bracket binario
     *       completo sin BYEs. Otros tamaños se rechazan con 400.</li>
     * </ul>
     *
     * <p>Validaciones de borde:
     * <ul>
     *   <li>Personajes deben existir todos — un id no encontrado es 404.</li>
     *   <li>No puede haber duplicados en la lista — 400.</li>
     * </ul>
     */
    @Transactional
    public Torneo crearPorUsuario(Usuario creador, TorneoCrearMioRequest request) {
        if (creador == null) {
            throw new IllegalArgumentException("Se requiere usuario autenticado");
        }
        if (!creador.estaVerificado()) {
            // Plan v2 §4.9: "Solo cuentas verificadas". Lanza 403 (Forbidden)
            // a través de un AccessDeniedException sería más natural, pero
            // GlobalExceptionHandler ya mapea IllegalStateException → 409
            // y no queremos un 409 confundible con "ya existe". 400 con
            // mensaje claro es la opción menos intrusiva sin tocar el handler.
            throw new IllegalArgumentException(
                    "Necesitas verificar tu email antes de crear torneos");
        }
        List<Long> ids = request.getParticipantesIds();
        if (ids == null || (ids.size() != 8 && ids.size() != 16)) {
            throw new IllegalArgumentException(
                    "El torneo debe tener exactamente 8 o 16 personajes (recibido: "
                            + (ids == null ? 0 : ids.size()) + ")");
        }
        if (ids.stream().distinct().count() != ids.size()) {
            throw new IllegalArgumentException("No puede haber personajes duplicados");
        }

        // Carga eager todos los personajes ANTES de empezar a persistir
        // para que un id inválido aborte sin dejar el torneo creado.
        List<Personaje> participantes = new ArrayList<>(ids.size());
        for (Long pid : ids) {
            Personaje p = personajeRepository.findById(pid)
                    .orElseThrow(() -> new EntityNotFoundException(
                            "Personaje no encontrado: id=" + pid));
            participantes.add(p);
        }

        String slug = generarSlugUnico(request.getNombre());
        Torneo torneo = new Torneo(slug, request.getNombre(), request.getDescripcion());
        torneo.setCreadoPor(creador);
        torneo.setEstadoRevision(EstadoRevision.PENDIENTE);
        Torneo guardado = torneoRepository.save(torneo);

        // Precomputa el bracket pero NO lo arranca — la aprobación admin
        // hará el switch a IN_PROGRESS. Mantenemos los matches como SCHEDULED
        // visibles solo al creador hasta entonces.
        bracketService.crearBracket(guardado, participantes);

        log.info("Torneo creado por user (PENDIENTE): id={} slug={} creador={} tamaño={}",
                guardado.getId(), slug, creador.getUsername(), ids.size());
        return guardado;
    }

    /**
     * Torneos creados por el usuario, todos los estados de revisión.
     * Usado por GET /api/torneos/mios para que el creador vea PENDIENTES
     * (esperando), APROBADOS (en juego) y RECHAZADOS (con motivo).
     */
    @Transactional(readOnly = true)
    public List<Torneo> listarTorneosDelUsuario(Usuario creador) {
        if (creador == null) return List.of();
        return torneoRepository.findByCreadoPorOrderByFechaCreacionDesc(creador);
    }

    /**
     * Genera un slug URL-safe a partir del nombre y le añade sufijo numérico
     * si ya existe en BBDD. Itera incrementando hasta encontrar uno libre.
     * Para nombres muy comunes podría iterar varias veces, pero el límite
     * práctico (80 chars de la columna) acota el número de tentativas.
     */
    String generarSlugUnico(String nombre) {
        String base = SlugUtil.slugify(nombre);
        if (!torneoRepository.existsBySlug(base)) {
            return base;
        }
        int sufijo = 2;
        while (torneoRepository.existsBySlug(base + "-" + sufijo)) {
            sufijo++;
        }
        return base + "-" + sufijo;
    }

    /**
     * Inicia un torneo cambiando su estado a IN_PROGRESS. Si el request lleva
     * `participantesIds` no vacíos, además crea el bracket precomputado en
     * cascada vía BracketService — uso recomendado del Plan v2 §1.1. Si el
     * request es null o sin participantes, solo cambia el estado y los
     * enfrentamientos deben crearse a mano con POST /enfrentamientos (modo
     * legacy mantenido para no romper tests existentes y el admin manual).
     */
    @Transactional
    public Torneo iniciar(Long id, TorneoIniciarRequest request) {
        Torneo torneo = torneoRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Torneo no encontrado: id=" + id));

        if (torneo.getEstado() != EstadoTorneo.SCHEDULED) {
            throw new IllegalStateException("Solo se pueden iniciar torneos en estado SCHEDULED");
        }

        torneo.setEstado(EstadoTorneo.IN_PROGRESS);
        torneo.setFechaInicio(LocalDateTime.now());
        Torneo guardado = torneoRepository.save(torneo);

        if (request != null && request.getParticipantesIds() != null && !request.getParticipantesIds().isEmpty()) {
            List<Personaje> participantes = new ArrayList<>();
            for (Long pid : request.getParticipantesIds()) {
                Personaje p = personajeRepository.findById(pid)
                        .orElseThrow(() -> new EntityNotFoundException("Personaje no encontrado: id=" + pid));
                participantes.add(p);
            }
            bracketService.crearBracket(guardado, participantes);
        }

        return guardado;
    }

    @Transactional
    public List<Enfrentamiento> crearEnfrentamientos(Long torneoId, List<EnfrentamientoCrearRequest> requests) {
        Torneo torneo = torneoRepository.findById(torneoId)
                .orElseThrow(() -> new EntityNotFoundException("Torneo no encontrado: id=" + torneoId));

        if (torneo.getEstado() == EstadoTorneo.FINISHED) {
            throw new IllegalStateException("No se pueden añadir enfrentamientos a un torneo FINISHED");
        }

        List<Enfrentamiento> creados = new ArrayList<>();
        for (EnfrentamientoCrearRequest req : requests) {
            // Validación de regla de negocio: un personaje no puede luchar contra sí mismo.
            if (req.getPersonaje1Id() != null && req.getPersonaje1Id().equals(req.getPersonaje2Id())) {
                throw new IllegalArgumentException(
                        "Un personaje no puede enfrentarse a sí mismo (id=" + req.getPersonaje1Id() + ")");
            }

            Personaje p1 = personajeRepository.findById(req.getPersonaje1Id())
                    .orElseThrow(() -> new EntityNotFoundException(
                            "Personaje no encontrado: id=" + req.getPersonaje1Id()));
            Personaje p2 = personajeRepository.findById(req.getPersonaje2Id())
                    .orElseThrow(() -> new EntityNotFoundException(
                            "Personaje no encontrado: id=" + req.getPersonaje2Id()));

            Enfrentamiento e = new Enfrentamiento(torneo, p1, p2);
            creados.add(enfrentamientoRepository.save(e));
        }
        return creados;
    }

    /**
     * Cierra el torneo y resuelve ganadores por conteo de votos en cada
     * enfrentamiento. Si hay empate exacto el ganador queda null (se gestiona
     * en frontend con un fallback determinístico por ELO).
     */
    @Transactional
    public Torneo finalizar(Long id) {
        Torneo torneo = torneoRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Torneo no encontrado: id=" + id));

        if (torneo.getEstado() != EstadoTorneo.IN_PROGRESS) {
            throw new IllegalStateException("Solo se pueden finalizar torneos en estado IN_PROGRESS");
        }

        List<Enfrentamiento> enfrentamientos = enfrentamientoRepository.findByTorneoOrderByRondaAscIdAsc(torneo);
        int maxRonda = 0;
        for (Enfrentamiento enf : enfrentamientos) {
            if (enf.getPersonaje1() == null || enf.getPersonaje2() == null) {
                // Slot vacío (ronda futura sin resolver); no contamos votos.
                continue;
            }
            long votosP1 = votoRepository.countByEnfrentamientoAndPersonaje(enf, enf.getPersonaje1());
            long votosP2 = votoRepository.countByEnfrentamientoAndPersonaje(enf, enf.getPersonaje2());

            if (votosP1 > votosP2) {
                enf.setGanador(enf.getPersonaje1());
            } else if (votosP2 > votosP1) {
                enf.setGanador(enf.getPersonaje2());
            }
            enfrentamientoRepository.save(enf);
            if (enf.getRonda() != null && enf.getRonda() > maxRonda) {
                maxRonda = enf.getRonda();
            }
        }

        // Sincroniza Torneo.ganadorPersonaje con el ganador del match de la
        // última ronda — fuente unificada de "quién ganó este torneo" para
        // el DTO de respuesta (TorneoQueryService.calcularGanadorSlug).
        if (maxRonda > 0) {
            for (Enfrentamiento enf : enfrentamientos) {
                if (Integer.valueOf(maxRonda).equals(enf.getRonda()) && enf.getGanador() != null) {
                    torneo.setGanadorPersonaje(enf.getGanador());
                    break;
                }
            }
        }

        torneo.setEstado(EstadoTorneo.FINISHED);
        torneo.setFechaFinalizacion(LocalDateTime.now());
        Torneo guardado = torneoRepository.save(torneo);

        // Plan v2 §4.4: resuelve todas las predicciones del torneo
        // comparando contra los ganadores recién calculados. Publica un
        // PrediccionResueltaEvent por usuario para que BadgeListener
        // compruebe streaks consecutivos y el badge profeta.
        int resueltas = prediccionService.resolverParaTorneo(guardado);
        log.info("Torneo {} finalizado: {} enfrentamientos + {} predicciones resueltas",
                id, enfrentamientos.size(), resueltas);
        return guardado;
    }
}
