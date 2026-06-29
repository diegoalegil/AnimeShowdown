package com.diegoalegil.animeshowdown.service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.SugerenciaPersonajeDto;
import com.diegoalegil.animeshowdown.dto.SugerirPersonajeRequest;
import com.diegoalegil.animeshowdown.model.NotificacionTipo;
import com.diegoalegil.animeshowdown.model.SugerenciaEstado;
import com.diegoalegil.animeshowdown.model.SugerenciaPersonaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.SugerenciaPersonajeRepository;

/**
 * Cola moderada de sugerencias de personaje.
 *
 * <p>El alta queda como PENDIENTE; un admin aprueba/rechaza. No se hace
 * auto-flag de profanidad porque TODA sugerencia pasa por un humano antes de
 * cualquier efecto — la moderación es la salvaguarda. Sí se aplica:
 * <ul>
 *   <li><strong>REGLA #7</strong>: la identidad debe ser concreta (no genérica).</li>
 *   <li><strong>Rate-limit</strong> atómico por usuario/hora (patrón V56).</li>
 * </ul>
 */
@Service
public class SugerenciaPersonajeService {

    private static final Logger log = LoggerFactory.getLogger(SugerenciaPersonajeService.class);

    /** Valores de identidad demasiado genéricos para cumplir REGLA #7. */
    private static final Set<String> IDENTIDAD_GENERICA = Set.of(
            "anime", "personaje", "personajes", "character", "hero", "heroe", "héroe",
            "waifu", "husbando", "protagonista", "villano", "n/a", "na", "-", "?", "??", "???");

    private final SugerenciaPersonajeRepository repository;
    private final NotificacionService notificacionService;
    private final JdbcTemplate jdbcTemplate;
    private final Clock clock;
    private final int rateLimitPorHora;

    public SugerenciaPersonajeService(
            SugerenciaPersonajeRepository repository,
            NotificacionService notificacionService,
            JdbcTemplate jdbcTemplate,
            Clock clock,
            @Value("${app.sugerencias.rate-limit-per-hour:3}") int rateLimitPorHora) {
        this.repository = repository;
        this.notificacionService = notificacionService;
        this.jdbcTemplate = jdbcTemplate;
        this.clock = clock;
        this.rateLimitPorHora = Math.max(1, rateLimitPorHora);
    }

    @Transactional
    public SugerenciaPersonajeDto crear(SugerirPersonajeRequest req, Usuario autor) {
        String identidad = req.identidad() == null ? "" : req.identidad().trim();
        if (identidad.length() < 3 || IDENTIDAD_GENERICA.contains(identidad.toLowerCase(Locale.ROOT))) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "La identidad debe ser concreta (kanji, emblema o referencia real), no genérica.");
        }
        LocalDateTime ahora = LocalDateTime.now(clock);
        if (!consumirCupo(autor.getId(), ahora)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Máximo " + rateLimitPorHora + " sugerencias por hora.");
        }
        SugerenciaPersonaje s = new SugerenciaPersonaje();
        s.setUsuario(autor);
        s.setNombre(req.nombre().trim());
        s.setAnime(req.anime().trim());
        s.setMotivo(blankToNull(req.motivo()));
        s.setIdentidad(identidad);
        s.setUrlReferencia(blankToNull(req.urlReferencia()));
        s.setEstado(SugerenciaEstado.PENDIENTE);
        s.setCreadoEn(ahora);
        SugerenciaPersonaje guardada = repository.save(s);
        log.info("Sugerencia de personaje creada: id={} usuario={} personaje={}",
                guardada.getId(), autor.getUsername(), guardada.getNombre());
        return SugerenciaPersonajeDto.from(guardada);
    }

    @Transactional(readOnly = true)
    public Page<SugerenciaPersonajeDto> listarMias(Usuario usuario, int page, int size) {
        return repository.findByUsuarioOrderByCreadoEnDesc(usuario, PageRequest.of(page, size))
                .map(SugerenciaPersonajeDto::from);
    }

    @Transactional(readOnly = true)
    public Page<SugerenciaPersonajeDto> listarPorEstado(SugerenciaEstado estado, int page, int size) {
        return repository.findByEstadoOrderByCreadoEnAsc(estado, PageRequest.of(page, size))
                .map(SugerenciaPersonajeDto::from);
    }

    @Transactional
    public SugerenciaPersonajeDto aprobar(Long id) {
        SugerenciaPersonaje s = cargarPendiente(id);
        s.setEstado(SugerenciaEstado.APROBADO);
        s.setRevisadoEn(LocalDateTime.now(clock));
        SugerenciaPersonaje guardada = repository.save(s);
        notificar(guardada, NotificacionTipo.SUGERENCIA_APROBADA,
                "Tu sugerencia fue aprobada",
                "¡Gracias por proponer a " + guardada.getNombre() + "! La estudiaremos para el catálogo.");
        return SugerenciaPersonajeDto.from(guardada);
    }

    @Transactional
    public SugerenciaPersonajeDto rechazar(Long id, String motivo) {
        SugerenciaPersonaje s = cargarPendiente(id);
        s.setEstado(SugerenciaEstado.RECHAZADO);
        s.setMotivoRechazo(motivo);
        s.setRevisadoEn(LocalDateTime.now(clock));
        SugerenciaPersonaje guardada = repository.save(s);
        notificar(guardada, NotificacionTipo.SUGERENCIA_RECHAZADA,
                "Tu sugerencia no salió adelante",
                guardada.getNombre() + ": " + motivo);
        return SugerenciaPersonajeDto.from(guardada);
    }

    private SugerenciaPersonaje cargarPendiente(Long id) {
        SugerenciaPersonaje s = repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sugerencia no encontrada"));
        if (s.getEstado() != SugerenciaEstado.PENDIENTE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La sugerencia ya fue moderada");
        }
        return s;
    }

    private void notificar(SugerenciaPersonaje s, NotificacionTipo tipo, String titulo, String mensaje) {
        try {
            String payload = "{\"sugerenciaId\":" + s.getId() + "}";
            // crearAislada (REQUIRES_NEW): la notificación es best-effort y corre
            // DENTRO de la tx @Transactional de aprobar()/rechazar(). En Postgres
            // un insert fallido aborta TODA la tx compartida, así que con crear()
            // (REQUIRED) este catch era una falsa red — la moderación commiteada
            // se perdía. Aislada, un fallo solo revierte su propia tx.
            notificacionService.crearAislada(s.getUsuario(), tipo, titulo, mensaje, payload);
        } catch (Exception e) {
            // La notificación es best-effort: no debe tumbar la moderación.
            log.warn("Notificación de sugerencia {} falló: {}", tipo, e.getMessage());
        }
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    // --- Rate-limit atómico (mismo patrón que ComentarioService/V56) ---

    private boolean consumirCupo(Long usuarioId, LocalDateTime ahora) {
        LocalDateTime ventana = ahora.truncatedTo(ChronoUnit.HOURS);
        if (incrementarCupo(usuarioId, ventana, ahora)) {
            return true;
        }
        Integer usados = usadosEnVentana(usuarioId, ventana);
        if (usados != null) {
            return false;
        }
        // INSERT idempotente (ON CONFLICT DO NOTHING) en vez de try/catch sobre
        // DuplicateKeyException: en Postgres un INSERT que viola la PK aborta TODA
        // la tx del @Transactional del llamador, así que el catch + UPDATE siguiente
        // fallaba con "current transaction is aborted" (H2 no lo reproduce). No lanza.
        int insertadas = jdbcTemplate.update("""
                INSERT INTO sugerencia_rate_limit (usuario_id, ventana_inicio, usados, actualizado_en)
                VALUES (?, ?, 1, ?)
                ON CONFLICT DO NOTHING
                """, usuarioId, ventana, ahora);
        if (insertadas == 1) {
            return true;
        }
        // Otro request creó la fila en la carrera: ahora incrementamos sobre ella.
        return incrementarCupo(usuarioId, ventana, ahora);
    }

    private boolean incrementarCupo(Long usuarioId, LocalDateTime ventana, LocalDateTime ahora) {
        int actualizados = jdbcTemplate.update("""
                UPDATE sugerencia_rate_limit
                SET usados = usados + 1,
                    actualizado_en = ?
                WHERE usuario_id = ?
                  AND ventana_inicio = ?
                  AND usados < ?
                """, ahora, usuarioId, ventana, rateLimitPorHora);
        return actualizados == 1;
    }

    private Integer usadosEnVentana(Long usuarioId, LocalDateTime ventana) {
        try {
            return jdbcTemplate.queryForObject("""
                    SELECT usados FROM sugerencia_rate_limit
                    WHERE usuario_id = ? AND ventana_inicio = ?
                    """, Integer.class, usuarioId, ventana);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }
}
