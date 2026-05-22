package com.diegoalegil.animeshowdown.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.EnfrentamientoCrearRequest;
import com.diegoalegil.animeshowdown.dto.TorneoCrearMioRequest;
import com.diegoalegil.animeshowdown.dto.TorneoCrearRequest;
import com.diegoalegil.animeshowdown.dto.TorneoIniciarRequest;
import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.EstadoRevision;
import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.NotificacionTipo;
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
    private final BracketAdvanceService bracketAdvanceService;
    private final PrediccionService prediccionService;
    private final NotificacionService notificacionService;
    private final IndexNowService indexNowService;

    public TorneoService(
            TorneoRepository torneoRepository,
            EnfrentamientoRepository enfrentamientoRepository,
            PersonajeRepository personajeRepository,
            VotoRepository votoRepository,
            BracketService bracketService,
            BracketAdvanceService bracketAdvanceService,
            PrediccionService prediccionService,
            NotificacionService notificacionService,
            IndexNowService indexNowService) {
        this.torneoRepository = torneoRepository;
        this.enfrentamientoRepository = enfrentamientoRepository;
        this.personajeRepository = personajeRepository;
        this.votoRepository = votoRepository;
        this.bracketService = bracketService;
        this.bracketAdvanceService = bracketAdvanceService;
        this.prediccionService = prediccionService;
        this.notificacionService = notificacionService;
        this.indexNowService = indexNowService;
    }

    public Torneo crear(TorneoCrearRequest request) {
        String slug = generarSlugUnico(request.getNombre());
        Torneo torneo = new Torneo(slug, request.getNombre(), request.getDescripcion());
        torneo.setPublico(true);
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
            // Plan v2 §4.9: "Solo cuentas verificadas".
            // Audit fix #11 (2026-05-21): antes lanzabamos IllegalArgumentException
            // → 400. Semanticamente correcto es 403 — el user esta autenticado
            // pero le falta permiso (verificacion). ResponseStatusException de
            // Spring mapea limpio a 403 sin tocar GlobalExceptionHandler ni
            // crear una excepcion custom.
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
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
        torneo.setPublico(request.esPublico());
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

    /** Cola admin de torneos pendientes de revisión, FIFO por fecha. */
    @Transactional(readOnly = true)
    public List<Torneo> listarPendientesRevision() {
        return torneoRepository.findByEstadoRevisionOrderByFechaCreacionAsc(
                EstadoRevision.PENDIENTE);
    }

    /**
     * Admin aprueba el torneo (Plan v2 §4.9): cambia estadoRevision a APROBADO
     * y lo inicia automáticamente (estado SCHEDULED → IN_PROGRESS) para que
     * pase a ser visible y votable de inmediato. Notif TORNEO_APROBADO al
     * creador (best-effort).
     */
    @Transactional
    public Torneo aprobar(Long id) {
        Torneo torneo = torneoRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Torneo no encontrado: id=" + id));
        if (torneo.getEstadoRevision() != EstadoRevision.PENDIENTE) {
            throw new IllegalStateException(
                    "Solo se pueden aprobar torneos en estado PENDIENTE (actual: "
                            + torneo.getEstadoRevision() + ")");
        }
        torneo.setEstadoRevision(EstadoRevision.APROBADO);
        torneo.setFechaRevisado(LocalDateTime.now());
        // El bracket ya se creó al recibir la propuesta. Auto-iniciar evita
        // que el creador tenga que pulsar "iniciar" después — el flow tras
        // aprobación es invisible para él, solo ve "ya está en juego".
        torneo.setEstado(EstadoTorneo.IN_PROGRESS);
        torneo.setFechaInicio(LocalDateTime.now());
        Torneo guardado = torneoRepository.save(torneo);

        notificarRevisado(guardado, NotificacionTipo.TORNEO_APROBADO,
                "Tu torneo ha sido aprobado",
                "\"" + guardado.getNombre() + "\" ya está en juego.",
                payloadDeTorneo(guardado));

        // Plan v2 §5.7: IndexNow ping a Bing/Yandex/etc. para que el
        // nuevo URL del torneo se indexe en minutos en lugar de horas.
        // Best-effort async; no afecta al flujo de aprobación si falla.
        indexNowService.notificarUna("/torneos/" + guardado.getSlug());

        log.info("Torneo aprobado: id={} slug={} creador={}",
                guardado.getId(), guardado.getSlug(),
                guardado.getCreadoPor() != null ? guardado.getCreadoPor().getUsername() : "(sin)");
        return guardado;
    }

    /**
     * Admin rechaza el torneo (Plan v2 §4.9): RECHAZADO + motivo persistido
     * para que el creador lo vea en "Mis torneos". El torneo queda sin
     * iniciar — el bracket precomputado no se borra (puede servir para
     * que el creador vuelva a enviarlo con ajustes, futuro).
     */
    @Transactional
    public Torneo rechazar(Long id, String motivo) {
        Torneo torneo = torneoRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Torneo no encontrado: id=" + id));
        if (torneo.getEstadoRevision() != EstadoRevision.PENDIENTE) {
            throw new IllegalStateException(
                    "Solo se pueden rechazar torneos en estado PENDIENTE (actual: "
                            + torneo.getEstadoRevision() + ")");
        }
        if (motivo == null || motivo.isBlank()) {
            throw new IllegalArgumentException("Debes indicar un motivo de rechazo");
        }
        torneo.setEstadoRevision(EstadoRevision.RECHAZADO);
        torneo.setMotivoRechazo(motivo.trim());
        torneo.setFechaRevisado(LocalDateTime.now());
        Torneo guardado = torneoRepository.save(torneo);

        notificarRevisado(guardado, NotificacionTipo.TORNEO_RECHAZADO,
                "Tu torneo no pasó la revisión",
                "\"" + guardado.getNombre() + "\" fue rechazado: " + motivo.trim(),
                payloadDeTorneo(guardado));

        log.info("Torneo rechazado: id={} slug={} motivo={}",
                guardado.getId(), guardado.getSlug(), motivo);
        return guardado;
    }

    private static String payloadDeTorneo(Torneo t) {
        // JSON manual mínimo para no traer Jackson en la capa de servicio.
        // Mientras el slug no contenga comillas (lo garantiza SlugUtil) el
        // string es válido. Si el día de mañana queremos campos más complejos
        // pasamos a ObjectMapper.
        return "{\"torneoId\":" + t.getId()
                + ",\"slug\":\"" + t.getSlug() + "\""
                + ",\"nombre\":\"" + escaparJson(t.getNombre()) + "\"}";
    }

    private static String escaparJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private void notificarRevisado(Torneo torneo, NotificacionTipo tipo,
            String titulo, String mensaje, String payload) {
        Usuario creador = torneo.getCreadoPor();
        if (creador == null) return; // legacy / huérfano
        try {
            notificacionService.crear(creador, tipo, titulo, mensaje, payload);
        } catch (Exception e) {
            log.warn("Notificación {} falló para torneo {}: {}",
                    tipo, torneo.getId(), e.getMessage());
        }
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
            // Audit fix #10 (2026-05-21): antes la ruta admin (iniciarTorneo)
            // creaba el bracket sin validar tamaño ni duplicados, mientras
            // que crearPorUsuario validaba ambos. Resultado: admin podía
            // crear torneos con 7 o 12 personajes (estructura rota) o con
            // duplicados (el mismo personaje en 2 enfrentamientos de la
            // misma ronda).
            //
            // Admin es más permisivo que crearPorUsuario (que exige 8 o
            // 16): aceptamos cualquier potencia de 2 entre 2 y 64. BracketService
            // requiere potencia de 2 para que el bracket cuadre, asi que validar
            // aqui antes da error claro en lugar de NPE/IllegalState dentro del
            // service.
            List<Long> ids = request.getParticipantesIds();
            int n = ids.size();
            boolean potenciaDe2 = n >= 2 && n <= 64 && (n & (n - 1)) == 0;
            if (!potenciaDe2) {
                throw new IllegalArgumentException(
                        "El torneo debe tener una potencia de 2 entre 2 y 64 personajes (recibido: "
                                + n + ")");
            }
            if (new java.util.HashSet<>(ids).size() != n) {
                throw new IllegalArgumentException(
                        "La lista de participantes no puede tener duplicados");
            }
            List<Personaje> participantes = new ArrayList<>();
            for (Long pid : ids) {
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
    /**
     * Finaliza un torneo: cierra cada ronda en cascada (calculando ganadores
     * por count de votos y propagando a la ronda siguiente vía
     * {@link BracketAdvanceService}) hasta que llega a la final.
     *
     * <p>Audit P1 (2026-05-17): antes este método iteraba todos los
     * enfrentamientos, saltaba los slots vacíos de rondas 2+ (que nunca se
     * rellenaban porque el BracketAvanceScheduler prometido no existía) y
     * marcaba el torneo como FINISHED igual. Resultado: torneos de 8/16
     * podían "terminar" con ganador del primer enfrentamiento como
     * "campeón". Ahora delega en BracketAdvanceService que sí propaga.
     *
     * <p>Si tras cerrar todas las rondas posibles el torneo NO queda
     * FINISHED (empate sin resolver, slots vacíos por bracket malformado),
     * se lanza IllegalStateException con mensaje accionable — preferimos
     * fallar fuerte a dejar el torneo a medias.
     */
    @Transactional
    public Torneo finalizar(Long id) {
        Torneo torneo = torneoRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Torneo no encontrado: id=" + id));

        if (torneo.getEstado() != EstadoTorneo.IN_PROGRESS) {
            throw new IllegalStateException("Solo se pueden finalizar torneos en estado IN_PROGRESS");
        }

        BracketAdvanceService.Resultado res = bracketAdvanceService.cerrarTodasLasRondas(torneo);

        if (res != BracketAdvanceService.Resultado.TORNEO_FINALIZADO) {
            throw new IllegalStateException(
                    "No se pudo finalizar el torneo: alguna ronda intermedia tiene empates o matches sin votos. "
                            + "Resuelve los empates o espera a tener votos suficientes.");
        }

        // Recargar tras los updates del advance service para tener el estado fresco
        Torneo guardado = torneoRepository.findById(id).orElseThrow();

        // Plan v2 §4.4: resuelve todas las predicciones del torneo
        // comparando contra los ganadores recién calculados.
        int resueltas = prediccionService.resolverParaTorneo(guardado);
        log.info("Torneo {} finalizado en cascada: {} predicciones resueltas", id, resueltas);
        return guardado;
    }
}
