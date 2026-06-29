package com.diegoalegil.animeshowdown.service;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.model.Comentario;
import com.diegoalegil.animeshowdown.model.ComentarioEstado;
import com.diegoalegil.animeshowdown.model.Rol;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.ComentarioRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;

@Service
public class ComentarioService {

    private final ComentarioRepository comentarioRepository;
    private final PersonajeRepository personajeRepository;
    private final JdbcTemplate jdbcTemplate;
    private final List<String> profanityStems;
    private final int rateLimitPorHora;
    private final int reportesUmbral;

    public ComentarioService(
            ComentarioRepository comentarioRepository,
            PersonajeRepository personajeRepository,
            JdbcTemplate jdbcTemplate,
            @Value("${app.comentarios.profanity-stems:puta,puto,mierd,joder,cabron,imbecil,pendej,cojon,fuck,shit,bitch,asshole,bastard,cunt,dick}") String profanityCsv,
            @Value("${app.comentarios.rate-limit-per-hour:5}") int rateLimitPorHora,
            @Value("${app.comentarios.reportes-umbral:3}") int reportesUmbral) {
        this.comentarioRepository = comentarioRepository;
        this.personajeRepository = personajeRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.profanityStems = Arrays.stream(profanityCsv.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .map(ComentarioService::normalizar)
                .toList();
        this.rateLimitPorHora = Math.max(1, rateLimitPorHora);
        this.reportesUmbral = Math.max(1, reportesUmbral);
    }

    @Transactional(readOnly = true)
    public Page<Comentario> listarPublicos(String slug, Pageable pageable) {
        return comentarioRepository.findByPersonajeSlugAndEstadoOrderByCreadoEnDesc(
                slug,
                ComentarioEstado.VISIBLE,
                pageable);
    }

    @Transactional
    public Comentario crear(String slug, String contenido, Usuario autor) {
        validarUsuario(autor);
        if (personajeRepository.findBySlug(slug).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Personaje no encontrado");
        }
        LocalDateTime ahora = LocalDateTime.now();
        if (!consumirCupoComentario(autor, ahora)) {
            throw new ResponseStatusException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "Máximo " + rateLimitPorHora + " comentarios por hora");
        }

        String limpio = limpiarContenido(contenido);
        ComentarioEstado estado = contieneProfanidad(limpio)
                ? ComentarioEstado.PENDIENTE_REVISION
                : ComentarioEstado.VISIBLE;
        return comentarioRepository.save(new Comentario(autor, slug, limpio, estado));
    }

    @Transactional
    public Comentario actualizar(Long id, String contenido, Usuario usuario) {
        validarUsuario(usuario);
        Comentario comentario = buscar(id);
        validarOwnerOAdmin(comentario, usuario);
        if (comentario.getEstado() == ComentarioEstado.ELIMINADO) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El comentario ya fue eliminado");
        }
        String limpio = limpiarContenido(contenido);
        comentario.setContenido(limpio);
        comentario.setEstado(contieneProfanidad(limpio)
                ? ComentarioEstado.PENDIENTE_REVISION
                : ComentarioEstado.VISIBLE);
        return comentario;
    }

    @Transactional
    public Comentario eliminar(Long id, Usuario usuario) {
        validarUsuario(usuario);
        Comentario comentario = buscar(id);
        validarOwnerOAdmin(comentario, usuario);
        comentario.setContenido("[comentario eliminado]");
        comentario.setEstado(ComentarioEstado.ELIMINADO);
        return comentario;
    }

    @Transactional
    public Comentario reportar(Long id, Usuario usuario) {
        validarUsuario(usuario);
        Comentario comentario = buscar(id);
        if (comentario.getAutor().getId().equals(usuario.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "No puedes reportar tu propio comentario");
        }
        if (comentario.getEstado() == ComentarioEstado.ELIMINADO) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El comentario ya fue eliminado");
        }
        // Dedup: un usuario solo puede reportar una vez (uk_reporte_comentario). Así el
        // contador refleja reportantes DISTINTOS y nadie lo infla con clics repetidos.
        if (comentarioRepository.insertarReporteSiFalta(id, usuario.getId()) == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya reportaste este comentario");
        }
        // El comentario solo se oculta (PENDIENTE_REVISION) al alcanzar el umbral de
        // reportantes distintos; antes un único reporte ocultaba cualquier comentario
        // del público al instante (censura trivial por cualquier cuenta).
        int actualizados = comentarioRepository.incrementarReporteConUmbral(
                id,
                reportesUmbral,
                ComentarioEstado.PENDIENTE_REVISION,
                ComentarioEstado.ELIMINADO);
        if (actualizados == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El comentario ya fue eliminado");
        }
        return buscar(id);
    }

    @Transactional(readOnly = true)
    public Page<Comentario> listarAdmin(ComentarioEstado estado, Pageable pageable) {
        if (estado == null) {
            return comentarioRepository.findAllByOrderByCreadoEnDesc(pageable);
        }
        return comentarioRepository.findByEstadoOrderByCreadoEnDesc(estado, pageable);
    }

    @Transactional
    public Comentario cambiarEstadoAdmin(Long id, ComentarioEstado estado) {
        Comentario comentario = buscar(id);
        comentario.setEstado(estado);
        if (estado == ComentarioEstado.ELIMINADO) {
            comentario.setContenido("[comentario eliminado]");
        }
        return comentario;
    }

    public boolean esMio(Comentario comentario, Usuario usuario) {
        return usuario != null && comentario.getAutor().getId().equals(usuario.getId());
    }

    private Comentario buscar(Long id) {
        return comentarioRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comentario no encontrado"));
    }

    private static void validarUsuario(Usuario usuario) {
        if (usuario == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Necesitas iniciar sesión");
        }
    }

    private static void validarOwnerOAdmin(Comentario comentario, Usuario usuario) {
        boolean owner = comentario.getAutor().getId().equals(usuario.getId());
        boolean admin = usuario.getRol() == Rol.ADMIN;
        if (!owner && !admin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No puedes editar este comentario");
        }
    }

    private static String limpiarContenido(String contenido) {
        if (contenido == null) {
            return "";
        }
        return contenido.trim().replaceAll("\\s+", " ");
    }

    private boolean contieneProfanidad(String contenido) {
        String normalizado = normalizar(contenido);
        return profanityStems.stream().anyMatch(normalizado::contains);
    }

    private boolean consumirCupoComentario(Usuario autor, LocalDateTime ahora) {
        LocalDateTime ventana = ahora.truncatedTo(ChronoUnit.HOURS);
        if (incrementarCupo(autor.getId(), ventana, ahora)) {
            return true;
        }
        Integer usados = usadosEnVentana(autor.getId(), ventana);
        if (usados != null) {
            return false;
        }
        // INSERT idempotente (ON CONFLICT DO NOTHING) en vez de try/catch sobre
        // DuplicateKeyException: en Postgres un INSERT que viola la PK aborta TODA
        // la tx del @Transactional del llamador, así que el catch + UPDATE siguiente
        // fallaba con "current transaction is aborted" (H2 no lo reproduce). No lanza.
        int insertadas = jdbcTemplate.update("""
                INSERT INTO comentario_rate_limit (usuario_id, ventana_inicio, usados, actualizado_en)
                VALUES (?, ?, 1, ?)
                ON CONFLICT DO NOTHING
                """, autor.getId(), ventana, ahora);
        if (insertadas == 1) {
            return true;
        }
        // Otro request creó la fila en la carrera: ahora incrementamos sobre ella.
        return incrementarCupo(autor.getId(), ventana, ahora);
    }

    private boolean incrementarCupo(Long usuarioId, LocalDateTime ventana, LocalDateTime ahora) {
        int actualizados = jdbcTemplate.update("""
                UPDATE comentario_rate_limit
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
                    SELECT usados
                    FROM comentario_rate_limit
                    WHERE usuario_id = ?
                      AND ventana_inicio = ?
                    """, Integer.class, usuarioId, ventana);
        } catch (EmptyResultDataAccessException ignored) {
            return null;
        }
    }

    private static String normalizar(String value) {
        String lower = value == null ? "" : value.toLowerCase(Locale.ROOT);
        return Normalizer.normalize(lower, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
    }
}
