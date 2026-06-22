package com.diegoalegil.animeshowdown.service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.NotificacionDto;
import com.diegoalegil.animeshowdown.model.Notificacion;
import com.diegoalegil.animeshowdown.model.NotificacionTipo;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.PushSubscription;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.NotificacionRepository;
import com.diegoalegil.animeshowdown.repository.PushSubscriptionRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.service.WebPushService.WebPushPayload;

/**
 * Notificaciones in-app.
 *
 * <p>Doble canal:
 * <ol>
 *   <li><strong>Persistencia</strong> en {@code notificaciones} para el
 *       historial de la campanita.</li>
 *   <li><strong>Push WebSocket</strong> al {@code /user/queue/notificaciones}
 *       para que el cliente, si está conectado, pinte un toast/badge en
 *       tiempo real sin esperar al siguiente refresh.</li>
 * </ol>
 *
 * <p>El push es <strong>best-effort</strong>: si el usuario no tiene una
 * sesión WS activa (o el broker está caído), la notificación queda
 * persistida y la verá al cargar la lista REST. No bloqueamos la
 * transacción esperando ACK del WS.
 */
@Service
public class NotificacionService {

    private static final Logger log = LoggerFactory.getLogger(NotificacionService.class);

    private static final String DESTINO_USUARIO = "/queue/notificaciones";

    private final NotificacionRepository repo;
    private final SimpMessagingTemplate messaging;
    private final PushSubscriptionRepository pushSubscriptionRepository;
    private final WebPushService webPushService;
    private final UsuarioRepository usuarioRepository;

    /**
     * SimpMessagingTemplate viene de spring-websocket. Lo dejamos
     * required=false para los tests que arrancan sin WebSocketConfig — no
     * cambia la persistencia, solo el push.
     */
    public NotificacionService(NotificacionRepository repo,
            @Autowired(required = false) SimpMessagingTemplate messaging,
            PushSubscriptionRepository pushSubscriptionRepository,
            WebPushService webPushService,
            UsuarioRepository usuarioRepository) {
        this.repo = repo;
        this.messaging = messaging;
        this.pushSubscriptionRepository = pushSubscriptionRepository;
        this.webPushService = webPushService;
        this.usuarioRepository = usuarioRepository;
    }

    @Transactional
    public Notificacion crear(Usuario usuario, NotificacionTipo tipo,
            String titulo, String mensaje, String payload) {
        Notificacion n = new Notificacion(usuario, tipo, titulo, mensaje, payload);
        Notificacion guardada = repo.save(n);
        log.info("Notificación creada: id={} usuario={} tipo={}",
                guardada.getId(), usuario.getUsername(), tipo);
        pushUsuario(usuario, NotificacionDto.from(guardada));
        return guardada;
    }

    /**
     * Crea una notificación idempotente por {@code eventoKey}: si ya existe una
     * del mismo usuario+tipo+eventoKey no hace nada y devuelve {@code false}. La
     * unicidad la respalda el índice {@code uk_notif_usuario_tipo_evento}; el
     * pre-check evita el insert en el caso normal (un único scheduler secuencial).
     *
     * <p>Pensado para fan-outs periódicos donde la misma alerta no debe repetirse
     * (p.ej. "tu favorito se movió", una vez por personaje/día/dirección).
     *
     * @return {@code true} si se creó una notificación nueva, {@code false} si ya existía.
     */
    // REQUIRES_NEW: corre en su PROPIA tx. Sin esto, si dos ejecuciones
    // concurrentes pasan el existsBy y una choca con el UNIQUE, el DIV marca
    // rollback-only la tx COMPARTIDA del llamador (voto/badge/notif) y revienta
    // todo. Aislada + capturando el DIV, la carrera se resuelve sin tocar al
    // llamador. (Misma convención que AuditLogService/BadgeService.)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean crearSiNoExiste(Usuario usuario, NotificacionTipo tipo,
            String titulo, String mensaje, String payload, String eventoKey) {
        if (usuario == null || eventoKey == null
                || repo.existsByUsuarioAndTipoAndEventoKey(usuario, tipo, eventoKey)) {
            return false;
        }
        Notificacion guardada;
        try {
            guardada = repo.saveAndFlush(
                    new Notificacion(usuario, tipo, titulo, mensaje, payload, eventoKey));
        } catch (DataIntegrityViolationException e) {
            // Carrera: otra ejecución la creó entre el existsBy y el insert.
            return false;
        }
        log.info("Notificación idempotente creada: id={} usuario={} tipo={} eventoKey={}",
                guardada.getId(), usuario.getUsername(), tipo, eventoKey);
        pushUsuario(usuario, NotificacionDto.from(guardada));
        return true;
    }

    @Transactional
    public int notificarTorneoDisponibleATodos(Torneo torneo) {
        String titulo = "Nuevo torneo disponible";
        String mensaje = "\"" + torneo.getNombre() + "\" ya esta listo para votar.";
        String url = "/torneos/" + torneo.getSlug();
        return notificarTorneoATodos(
                torneo,
                NotificacionTipo.TORNEO_INICIADO,
                titulo,
                mensaje,
                new WebPushPayload(titulo, mensaje, url, "torneo-iniciado-" + torneo.getId()));
    }

    @Transactional
    public int notificarTorneoFinalizadoATodos(Torneo torneo) {
        Personaje ganador = torneo.getGanadorPersonaje();
        String ganadorTexto = ganador != null ? " Campeon: " + ganador.getNombre() + "." : "";
        String titulo = "Torneo finalizado";
        String mensaje = "\"" + torneo.getNombre() + "\" ya tiene resultado." + ganadorTexto;
        String url = "/torneos/" + torneo.getSlug();
        return notificarTorneoATodos(
                torneo,
                NotificacionTipo.TORNEO_FINALIZADO,
                titulo,
                mensaje,
                new WebPushPayload(titulo, mensaje, url, "torneo-finalizado-" + torneo.getId()));
    }

    private int notificarTorneoATodos(Torneo torneo, NotificacionTipo tipo, String titulo,
            String mensaje, WebPushPayload webPayload) {
        List<PushSubscription> subscriptions = pushSubscriptionRepository.findAllFetchUsuario();
        if (subscriptions.isEmpty()) return 0;

        Map<Long, List<PushSubscription>> porUsuario = new LinkedHashMap<>();
        for (PushSubscription sub : subscriptions) {
            Usuario usuario = sub.getUsuario();
            if (usuario == null || usuario.getId() == null) continue;
            porUsuario.computeIfAbsent(usuario.getId(), ignored -> new java.util.ArrayList<>()).add(sub);
        }

        String payload = payloadDeTorneo(torneo);
        String eventoKey = payload;
        int creadas = 0;
        for (List<PushSubscription> subsUsuario : porUsuario.values()) {
            Usuario usuario = subsUsuario.get(0).getUsuario();
            Usuario usuarioBloqueado = usuarioRepository.findForUpdateById(usuario.getId())
                    .orElse(null);
            if (usuarioBloqueado == null
                    || repo.existsByUsuarioAndTipoAndEventoKey(usuarioBloqueado, tipo, eventoKey)) {
                continue;
            }

            Notificacion guardada = repo.saveAndFlush(
                    new Notificacion(usuarioBloqueado, tipo, titulo, mensaje, payload, eventoKey));
            pushUsuario(usuarioBloqueado, NotificacionDto.from(guardada));
            creadas++;

            for (PushSubscription sub : subsUsuario) {
                var result = webPushService.enviar(sub, webPayload);
                if (result.removeSubscription()) {
                    pushSubscriptionRepository.delete(sub);
                }
            }
        }
        log.info("Notificacion {} fan-out: torneo={} usuarios={}", tipo, torneo.getId(), creadas);
        return creadas;
    }

    /**
     * Push al user-specific queue. Si no hay broker (tests, modo degradado)
     * o el usuario no está conectado, no falla — Spring se ocupa de eso.
     */
    private void pushUsuario(Usuario usuario, NotificacionDto dto) {
        if (messaging == null) return;
        try {
            messaging.convertAndSendToUser(usuario.getUsername(), DESTINO_USUARIO, dto);
        } catch (Exception e) {
            // El push es best-effort. Si falla solo logueamos — la
            // persistencia ya está hecha, el cliente lo verá en el próximo
            // load del historial.
            log.warn("Push WS notificación falló: usuario={} err={}",
                    usuario.getUsername(), e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public Page<Notificacion> listar(Usuario usuario, Pageable pageable, boolean soloNoLeidas) {
        return soloNoLeidas
                ? repo.findByUsuarioAndLeidaFalseOrderByCreadoEnDesc(usuario, pageable)
                : repo.findByUsuarioOrderByCreadoEnDesc(usuario, pageable);
    }

    @Transactional(readOnly = true)
    public long countNoLeidas(Usuario usuario) {
        return repo.countByUsuarioAndLeidaFalse(usuario);
    }

    /**
     * Marca una notificación como leída. Solo el dueño puede.
     * @return Empty si no existe, Empty con flag false si no es del usuario.
     */
    @Transactional
    public Optional<Notificacion> marcarLeida(Long id, Usuario usuario) {
        Optional<Notificacion> opt = repo.findById(id);
        if (opt.isEmpty()) return Optional.empty();
        Notificacion n = opt.get();
        if (!n.getUsuario().getId().equals(usuario.getId())) {
            return Optional.empty();
        }
        if (!n.isLeida()) {
            n.setLeida(true);
            repo.save(n);
        }
        return Optional.of(n);
    }

    @Transactional
    public int marcarTodasLeidas(Usuario usuario) {
        int actualizadas = repo.marcarTodasLeidasPorUsuario(usuario);
        log.info("Notificaciones marcadas leídas: usuario={} cantidad={}",
                usuario.getUsername(), actualizadas);
        return actualizadas;
    }

    private static String payloadDeTorneo(Torneo t) {
        return "{\"torneoId\":" + t.getId()
                + ",\"slug\":\"" + t.getSlug() + "\""
                + ",\"nombre\":\"" + escaparJson(t.getNombre()) + "\"}";
    }

    private static String escaparJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
