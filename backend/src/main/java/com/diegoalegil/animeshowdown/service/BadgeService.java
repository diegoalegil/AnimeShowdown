package com.diegoalegil.animeshowdown.service;

import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.model.AuditEvento;
import com.diegoalegil.animeshowdown.model.Logro;
import com.diegoalegil.animeshowdown.model.NotificacionTipo;
import com.diegoalegil.animeshowdown.model.Personaje;
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
        return desbloquearLogro(usuario, logro, null);
    }

    @Transactional
    public Optional<UsuarioLogro> desbloquearMadrugador(Usuario usuario, Personaje personaje, LocalDateTime hora) {
        if (usuario == null || personaje == null || personaje.getSlug() == null) {
            return Optional.empty();
        }
        Logro logro = obtenerOCrearLogroMadrugador(personaje, hora);
        return desbloquearLogro(usuario, logro, hora);
    }

    @Transactional
    public Optional<UsuarioLogro> desbloquearOtakuCertificado(Usuario usuario) {
        return desbloquear(usuario, "otaku_certificado");
    }

    private Optional<UsuarioLogro> desbloquearLogro(Usuario usuario, Logro logro, LocalDateTime desbloqueadoEn) {
        // Pre-check rápido para evitar el round-trip al UNIQUE constraint
        // en el caso común (badge ya desbloqueado).
        if (usuarioLogroRepo.existsByUsuarioAndLogro(usuario, logro)) {
            return Optional.empty();
        }
        try {
            // Audit P3 (2026-05-17): saveAndFlush en lugar de save. Con save,
            // Hibernate puede aplazar el INSERT hasta el commit; si dos
            // listeners paralelos hacen el pre-check y avanzan, ambos save
            // pasan en el primer-level cache y la violación UNIQUE salta en
            // el commit final — FUERA de este try/catch. saveAndFlush fuerza
            // el INSERT inmediato, así la DataIntegrityViolationException
            // se lanza dentro del try y la atrapamos correctamente.
            UsuarioLogro guardado = usuarioLogroRepo.saveAndFlush(new UsuarioLogro(usuario, logro,
                    desbloqueadoEn == null ? LocalDateTime.now() : desbloqueadoEn));
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

    private Logro obtenerOCrearLogroMadrugador(Personaje personaje, LocalDateTime hora) {
        String codigo = codigoMadrugador(personaje.getSlug());
        return logroRepo.findByCodigo(codigo)
                .orElseGet(() -> crearLogroMadrugador(personaje, codigo, hora));
    }

    private Logro crearLogroMadrugador(Personaje personaje, String codigo, LocalDateTime hora) {
        String nombre = "Madrugador - " + left(personaje.getNombre(), 82);
        String descripcion = "Primera persona en votar a " + left(personaje.getNombre(), 170)
                + " en el dia UTC.";
        try {
            return logroRepo.saveAndFlush(new Logro(codigo, nombre, descripcion, "Sunrise", (short) 3));
        } catch (DataIntegrityViolationException e) {
            return logroRepo.findByCodigo(codigo).orElseThrow(() -> e);
        }
    }

    private static String codigoMadrugador(String slug) {
        String base = "madrugador_" + slug;
        if (base.length() <= 64) {
            return base;
        }
        String hash = Integer.toHexString(slug.hashCode());
        int maxSlug = Math.max(1, 64 - "madrugador_".length() - hash.length() - 1);
        return "madrugador_" + slug.substring(0, Math.min(slug.length(), maxSlug)) + "_" + hash;
    }

    private static String left(String value, int maxLength) {
        if (value == null) {
            return "";
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
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
        return logroRepo.findCatalogoEstatico();
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
        List<com.diegoalegil.animeshowdown.dto.LogroDto> resultado = new java.util.ArrayList<>(logroRepo.findCatalogoEstatico().stream()
                .map(logro -> {
                    UsuarioLogro ul = indexPorLogro.get(logro.getId());
                    return ul != null
                            ? com.diegoalegil.animeshowdown.dto.LogroDto.desbloqueado(ul)
                            : com.diegoalegil.animeshowdown.dto.LogroDto.deCatalogo(logro);
                })
                .toList());
        for (UsuarioLogro ul : mios) {
            if (ul.getLogro().getCodigo().startsWith("madrugador_")) {
                resultado.add(com.diegoalegil.animeshowdown.dto.LogroDto.desbloqueado(ul));
            }
        }
        return resultado;
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
        for (Logro l : logroRepo.findCatalogoEstatico()) {
            resultado.put(l.getCodigo(), porId.getOrDefault(l.getId(), 0L));
        }
        return resultado;
    }
}
