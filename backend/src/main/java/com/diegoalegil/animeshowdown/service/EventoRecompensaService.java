package com.diegoalegil.animeshowdown.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.model.AuditEvento;
import com.diegoalegil.animeshowdown.model.Carta;
import com.diegoalegil.animeshowdown.model.EventoRecompensaEntregada;
import com.diegoalegil.animeshowdown.model.EventoTematico;
import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.EventoRecompensaEntregadaRepository;
import com.diegoalegil.animeshowdown.repository.EventoTematicoRepository;
import com.diegoalegil.animeshowdown.repository.PrediccionRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

/**
 * Reparte las recompensas exclusivas de una copa de evento al finalizar.
 *
 * <p>Cohorte premiable = TODOS los usuarios que predijeron en la copa
 * (acierten o no). A cada uno, según lo configurado en el {@link EventoTematico}:
 * <ul>
 *   <li>moneda extra (idempotente por referencia en el monedero),</li>
 *   <li>la carta ESPECIAL exclusiva del evento,</li>
 *   <li>una insignia/título (badge, idempotente),</li>
 *   <li>un crédito de sobre gratis para abrir más tarde (gancho de reenganche).</li>
 * </ul>
 *
 * <p>El reparto corre en una transacción propia ({@code REQUIRES_NEW}) para no
 * acoplar su éxito al commit del finalize, y es idempotente por
 * {@code (torneo, usuario)} vía {@code evento_recompensa_entregada}: si el
 * scheduler vuelve a disparar el finalize, los ya premiados se saltan.
 */
@Service
public class EventoRecompensaService {

    private static final Logger log = LoggerFactory.getLogger(EventoRecompensaService.class);

    private final EventoTematicoRepository eventoRepository;
    private final PrediccionRepository prediccionRepository;
    private final EventoRecompensaEntregadaRepository entregadaRepository;
    private final UsuarioRepository usuarioRepository;
    private final MonederoService monederoService;
    private final BadgeService badgeService;
    private final CartaService cartaService;
    private final AuditLogService auditLogService;

    public EventoRecompensaService(
            EventoTematicoRepository eventoRepository,
            PrediccionRepository prediccionRepository,
            EventoRecompensaEntregadaRepository entregadaRepository,
            UsuarioRepository usuarioRepository,
            MonederoService monederoService,
            BadgeService badgeService,
            CartaService cartaService,
            AuditLogService auditLogService) {
        this.eventoRepository = eventoRepository;
        this.prediccionRepository = prediccionRepository;
        this.entregadaRepository = entregadaRepository;
        this.usuarioRepository = usuarioRepository;
        this.monederoService = monederoService;
        this.badgeService = badgeService;
        this.cartaService = cartaService;
        this.auditLogService = auditLogService;
    }

    /**
     * Reparte las recompensas de la copa si el torneo es de un evento con
     * recompensas configuradas. No-op (devuelve 0) en cualquier otro caso.
     *
     * @return número de usuarios premiados en esta llamada.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int repartirPorTorneoFinalizado(Torneo torneo) {
        String slug = torneo.getEventoSlug();
        if (slug == null || slug.isBlank()) {
            return 0;
        }
        EventoTematico evento = eventoRepository.findBySlug(slug).orElse(null);
        if (evento == null || !tieneRecompensa(evento)) {
            return 0;
        }

        List<Long> usuarioIds = prediccionRepository.findDistinctUsuarioIdsByTorneo(torneo);
        if (usuarioIds.isEmpty()) {
            return 0;
        }

        int premiados = 0;
        for (Usuario usuario : usuarioRepository.findAllById(usuarioIds)) {
            if (entregadaRepository.existsByTorneoIdAndUsuarioId(torneo.getId(), usuario.getId())) {
                continue;
            }
            try {
                if (premiarUsuario(torneo, evento, usuario)) {
                    premiados++;
                }
            } catch (Exception e) {
                log.warn("Recompensa de evento falló: torneo={} usuario={} err={}",
                        torneo.getId(), usuario.getId(), e.getMessage());
            }
        }
        log.info("Recompensas de evento repartidas: torneo={} evento={} premiados={} cohorte={}",
                torneo.getId(), slug, premiados, usuarioIds.size());
        return premiados;
    }

    private boolean premiarUsuario(Torneo torneo, EventoTematico evento, Usuario usuario) {
        String referencia = referenciaEvento(evento, torneo, usuario);
        int moneda = Math.max(0, evento.getRecompensaMoneda());
        if (moneda > 0) {
            monederoService.acreditar(usuario, MotivoMovimiento.RECOMPENSA_EVENTO, referencia, moneda);
        }

        Carta especial = cartaService.concederCartaEspecialPorSlug(
                usuario, evento.getRecompensaCartaEspecialSlug());
        Long cartaEspecialId = especial != null ? especial.getId() : null;

        String badge = evento.getRecompensaBadgeCodigo();
        boolean tieneBadge = badge != null && !badge.isBlank();
        if (tieneBadge) {
            badgeService.desbloquear(usuario, badge);
        }

        boolean sobreGratis = evento.isRecompensaSobreGratis();
        if (sobreGratis) {
            cartaService.otorgarCreditoSobre(usuario.getId(), origenEvento(evento),
                    referencia, "Sobre de " + evento.getTitulo());
        }

        try {
            entregadaRepository.saveAndFlush(new EventoRecompensaEntregada(
                    torneo.getId(), usuario.getId(), evento.getSlug(),
                    moneda, cartaEspecialId, tieneBadge ? badge : null, sobreGratis));
        } catch (DataIntegrityViolationException e) {
            // Otra ejecución ya marcó a este usuario como premiado en esta copa.
            // Las piezas son idempotentes por referencia, así que no hay doble entrega.
            return false;
        }

        auditLogService.registrar(
                AuditEvento.EVENTO_RECOMPENSA_ENTREGADA,
                usuario,
                Map.of(
                        "evento", evento.getSlug(),
                        "torneo", torneo.getId(),
                        "moneda", moneda,
                        "cartaEspecial", cartaEspecialId != null ? cartaEspecialId : "",
                        "badge", tieneBadge ? badge : "",
                        "sobreGratis", sobreGratis),
                null);
        return true;
    }

    // Acota referencia/origen cuando el slug del evento es largo: evita desbordar
    // monedero_movimiento.referencia(96) y sobre_gratis_credito.origen(80) — un
    // desbordamiento hacía que la recompensa nunca se entregara (DIV silenciosa)
    // y cada re-finalize reintentara. Solo se hashea SI desbordaría, así los slugs
    // cortos conservan su clave exacta (cero riesgo de doble-crédito en re-finalize);
    // la idempotencia real la da EventoRecompensaEntregada UNIQUE(torneo,usuario).
    static String referenciaEvento(EventoTematico evento, Torneo torneo, Usuario usuario) {
        String ref = "evento:" + evento.getSlug() + ":" + torneo.getId() + ":" + usuario.getId();
        if (ref.length() <= 96) return ref;
        return "evento:" + hashSlug(evento.getSlug()) + ":" + torneo.getId() + ":" + usuario.getId();
    }

    static String origenEvento(EventoTematico evento) {
        String origen = "evento:" + evento.getSlug();
        return origen.length() <= 80 ? origen : "evento:" + hashSlug(evento.getSlug());
    }

    private static String hashSlug(String slug) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(slug.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(h); // 43 chars
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible", e); // nunca: algoritmo estándar
        }
    }

    private boolean tieneRecompensa(EventoTematico e) {
        return e.getRecompensaMoneda() > 0
                || (e.getRecompensaCartaEspecialSlug() != null && !e.getRecompensaCartaEspecialSlug().isBlank())
                || (e.getRecompensaBadgeCodigo() != null && !e.getRecompensaBadgeCodigo().isBlank())
                || e.isRecompensaSobreGratis();
    }
}
