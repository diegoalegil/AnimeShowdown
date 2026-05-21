package com.diegoalegil.animeshowdown.service;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
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
    private final List<String> profanityStems;
    private final int rateLimitPorHora;

    public ComentarioService(
            ComentarioRepository comentarioRepository,
            PersonajeRepository personajeRepository,
            @Value("${app.comentarios.profanity-stems:puta,puto,mierd,joder,cabron,imbecil,pendej,cojon,fuck,shit,bitch,asshole,bastard,cunt,dick}") String profanityCsv,
            @Value("${app.comentarios.rate-limit-per-hour:5}") int rateLimitPorHora) {
        this.comentarioRepository = comentarioRepository;
        this.personajeRepository = personajeRepository;
        this.profanityStems = Arrays.stream(profanityCsv.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .map(ComentarioService::normalizar)
                .toList();
        this.rateLimitPorHora = Math.max(1, rateLimitPorHora);
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
        LocalDateTime desde = LocalDateTime.now().minusHours(1);
        long recientes = comentarioRepository.countByAutorAndCreadoEnAfter(autor, desde);
        if (recientes >= rateLimitPorHora) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Máximo 5 comentarios por hora");
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
        comentario.incrementarReportes();
        comentario.setEstado(ComentarioEstado.PENDIENTE_REVISION);
        return comentario;
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

    private static String normalizar(String value) {
        String lower = value == null ? "" : value.toLowerCase(Locale.ROOT);
        return Normalizer.normalize(lower, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
    }
}
