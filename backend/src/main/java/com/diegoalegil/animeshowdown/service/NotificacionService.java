package com.diegoalegil.animeshowdown.service;

import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.NotificacionDto;
import com.diegoalegil.animeshowdown.model.Notificacion;
import com.diegoalegil.animeshowdown.model.NotificacionTipo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.NotificacionRepository;

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

    /**
     * SimpMessagingTemplate viene de spring-websocket. Lo dejamos
     * required=false para los tests que arrancan sin WebSocketConfig — no
     * cambia la persistencia, solo el push.
     */
    public NotificacionService(NotificacionRepository repo,
            @Autowired(required = false) SimpMessagingTemplate messaging) {
        this.repo = repo;
        this.messaging = messaging;
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
}
