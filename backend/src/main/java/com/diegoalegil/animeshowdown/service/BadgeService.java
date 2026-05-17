package com.diegoalegil.animeshowdown.service;

import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.model.AuditEvento;
import com.diegoalegil.animeshowdown.model.Logro;
import com.diegoalegil.animeshowdown.model.NotificacionTipo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioLogro;
import com.diegoalegil.animeshowdown.repository.LogroRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioLogroRepository;

/**
 * Desbloqueo de badges/logros (Plan v2 §4.2).
 *
 * <p>API principal:
 * <ul>
 *   <li>{@link #desbloquear(Usuario, String)} — idempotente, no falla si ya
 *       estaba desbloqueado. Cuando es la primera vez, dispara una
 *       notificación in-app tipo BADGE_DESBLOQUEADO con el payload del badge,
 *       y un evento de audit.</li>
 *   <li>{@link #listarUsuario(Usuario)} — los desbloqueados del usuario,
 *       ordenados por fecha desc.</li>
 *   <li>{@link #listarCatalogo()} — los 14 badges del catálogo, para que
 *       el frontend pinte los "que te faltan" con icono atenuado.</li>
 * </ul>
 *
 * <p>La idempotencia se apoya en el UNIQUE constraint a nivel BBDD —
 * capturamos {@link DataIntegrityViolationException} en caso de race
 * condition entre dos eventos disparados a la vez para el mismo badge.
 */
@Service
public class BadgeService {

    private static final Logger log = LoggerFactory.getLogger(BadgeService.class);

    private final LogroRepository logroRepo;
    private final UsuarioLogroRepository usuarioLogroRepo;
    private final NotificacionService notificacionService;
    private final AuditLogService auditLogService;

    public BadgeService(LogroRepository logroRepo,
            UsuarioLogroRepository usuarioLogroRepo,
            NotificacionService notificacionService,
            AuditLogService auditLogService) {
        this.logroRepo = logroRepo;
        this.usuarioLogroRepo = usuarioLogroRepo;
        this.notificacionService = notificacionService;
        this.auditLogService = auditLogService;
    }

    /**
     * Desbloquea el badge dado para el usuario si no lo tenía. Idempotente.
     *
     * @return Optional con el UsuarioLogro recién creado si fue la primera
     *         vez; empty si ya estaba desbloqueado o el código no existe.
     */
    @Transactional
    public Optional<UsuarioLogro> desbloquear(Usuario usuario, String codigoLogro) {
        if (usuario == null || codigoLogro == null) return Optional.empty();
        Optional<Logro> logroOpt = logroRepo.findByCodigo(codigoLogro);
        if (logroOpt.isEmpty()) {
            log.warn("Intento de desbloquear badge inexistente: codigo={}", codigoLogro);
            return Optional.empty();
        }
        Logro logro = logroOpt.get();
        // Pre-check rápido para evitar el round-trip al UNIQUE constraint
        // en el caso común (badge ya desbloqueado).
        if (usuarioLogroRepo.existsByUsuarioAndLogro(usuario, logro)) {
            return Optional.empty();
        }
        try {
            UsuarioLogro guardado = usuarioLogroRepo.save(new UsuarioLogro(usuario, logro));
            log.info("Badge desbloqueado: usuario={} codigo={} rareza={}",
                    usuario.getUsername(), logro.getCodigo(), logro.getRareza());
            notificarYAuditar(usuario, logro);
            return Optional.of(guardado);
        } catch (DataIntegrityViolationException e) {
            // Race condition: dos eventos paralelos intentaron desbloquear
            // el mismo badge a la vez. El UNIQUE constraint nos defiende.
            log.debug("Race condition en desbloqueo de badge: usuario={} codigo={}",
                    usuario.getUsername(), logro.getCodigo());
            return Optional.empty();
        }
    }

    private void notificarYAuditar(Usuario usuario, Logro logro) {
        String payload = String.format(
                "{\"codigo\":\"%s\",\"icono\":\"%s\",\"rareza\":%d}",
                logro.getCodigo(), logro.getIcono(), logro.getRareza());
        try {
            notificacionService.crear(
                    usuario,
                    NotificacionTipo.BADGE_DESBLOQUEADO,
                    "¡Has desbloqueado un logro!",
                    logro.getNombre() + " — " + logro.getDescripcion(),
                    payload);
        } catch (Exception e) {
            // Si la notificación falla, no anulamos el desbloqueo. El badge
            // ya está persistido; el usuario lo verá en su perfil aunque
            // pierda el toast en vivo.
            log.warn("Notificación BADGE_DESBLOQUEADO falló: {}", e.getMessage());
        }
        try {
            // request=null porque los desbloqueos los disparan EventListeners
            // que no tienen acceso al HttpServletRequest original. El audit
            // queda con ip/user_agent null, que es esperado para estos eventos.
            auditLogService.registrar(
                    AuditEvento.BADGE_DESBLOQUEADO,
                    usuario,
                    java.util.Map.of("codigo", logro.getCodigo()),
                    null);
        } catch (Exception e) {
            log.warn("Audit BADGE_DESBLOQUEADO falló: {}", e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public List<UsuarioLogro> listarUsuario(Usuario usuario) {
        return usuarioLogroRepo.findByUsuarioOrderByDesbloqueadoEnDesc(usuario);
    }

    @Transactional(readOnly = true)
    public List<Logro> listarCatalogo() {
        return logroRepo.findAll();
    }

    /**
     * Devuelve TODOS los badges del catálogo enriquecidos con la fecha de
     * desbloqueo del usuario (null para los que aún no tiene). El merge se
     * hace dentro de la transacción para evitar LazyInitializationException
     * al acceder a {@code UsuarioLogro.logro} desde el controller.
     */
    @Transactional(readOnly = true)
    public List<com.diegoalegil.animeshowdown.dto.LogroDto> listarCatalogoConDesbloqueos(Usuario usuario) {
        List<UsuarioLogro> mios = usuarioLogroRepo.findByUsuarioOrderByDesbloqueadoEnDesc(usuario);
        // Index por logro_id para O(n) en lugar de O(n*m) cuando hay muchos
        // logros y muchos desbloqueos.
        java.util.Map<Long, UsuarioLogro> indexPorLogro = new java.util.HashMap<>();
        for (UsuarioLogro ul : mios) {
            indexPorLogro.put(ul.getLogro().getId(), ul);
        }
        return logroRepo.findAll().stream()
                .map(logro -> {
                    UsuarioLogro ul = indexPorLogro.get(logro.getId());
                    return ul != null
                            ? com.diegoalegil.animeshowdown.dto.LogroDto.desbloqueado(ul)
                            : com.diegoalegil.animeshowdown.dto.LogroDto.deCatalogo(logro);
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public long contarDesbloqueados(Usuario usuario) {
        return usuarioLogroRepo.countByUsuario(usuario);
    }

    /**
     * Mapa {@code codigo → count} con cuántos usuarios han desbloqueado
     * cada badge. Los badges con 0 desbloqueos se incluyen explícitamente
     * (count=0) para que el frontend no tenga que defaultear.
     *
     * <p>Pensado para /logros — sirve para mostrar rareza real comunidad
     * al lado de la rareza nominal del catálogo.
     */
    @Transactional(readOnly = true)
    public java.util.Map<String, Long> contarDesbloqueosPorBadge() {
        java.util.Map<Long, Long> porId = new java.util.HashMap<>();
        for (Object[] row : usuarioLogroRepo.contarDesbloqueosPorLogro()) {
            porId.put((Long) row[0], (Long) row[1]);
        }
        java.util.Map<String, Long> resultado = new java.util.LinkedHashMap<>();
        for (Logro l : logroRepo.findAll()) {
            resultado.put(l.getCodigo(), porId.getOrDefault(l.getId(), 0L));
        }
        return resultado;
    }
}
