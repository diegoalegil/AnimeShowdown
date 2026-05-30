package com.diegoalegil.animeshowdown.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.ActividadItemDto;
import com.diegoalegil.animeshowdown.dto.FeedDto;
import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.EstadoRevision;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioLogro;
import com.diegoalegil.animeshowdown.model.Voto;
import com.diegoalegil.animeshowdown.repository.FeedRepository;
import com.diegoalegil.animeshowdown.repository.SeguidorRepository;

/**
 * Feed de comunidad (B7 §2): mezcla la actividad reciente —votos, logros y
 * torneos creados— de los usuarios que el caller sigue, en el mismo shape que
 * {@link PerfilService} produce para el feed personal, pero con la autoría
 * (username + avatar) en el payload de cada item.
 *
 * <p>Lectura en una transacción para que los accesos lazy del mapeo a DTO
 * sucedan con la session viva; las queries usan JOIN FETCH ({@link
 * FeedRepository}) para evitar N+1.
 */
@Service
public class FeedService {

    /** Tope de seguidos en la cláusula IN (acota el coste para super-followers). */
    private static final int MAX_SEGUIDOS = 200;
    /** Tope por tipo de evento traído antes de mezclar/paginar. */
    private static final int MAX_POR_TIPO = 150;

    private final SeguidorRepository seguidorRepository;
    private final FeedRepository feedRepository;

    public FeedService(SeguidorRepository seguidorRepository, FeedRepository feedRepository) {
        this.seguidorRepository = seguidorRepository;
        this.feedRepository = feedRepository;
    }

    @Transactional(readOnly = true)
    public FeedDto feed(Usuario usuario, int page, int size) {
        int p = Math.max(0, page);
        int s = Math.min(50, Math.max(1, size));

        List<Usuario> seguidos = seguidorRepository.seguidosDe(usuario);
        if (seguidos.isEmpty()) {
            return new FeedDto(List.of(), false, false);
        }
        if (seguidos.size() > MAX_SEGUIDOS) {
            seguidos = seguidos.subList(0, MAX_SEGUIDOS);
        }

        // Sobre-traemos hasta el final de la página pedida (+1 para detectar si
        // hay más), acotado por un máximo por tipo para no degradar la query.
        int hasta = Math.min(MAX_POR_TIPO, (p + 1) * s + 1);
        Pageable lim = PageRequest.of(0, hasta);

        List<ActividadItemDto> todos = new ArrayList<>();
        for (Voto v : feedRepository.feedVotos(seguidos, lim)) {
            todos.add(itemVoto(v));
        }
        for (UsuarioLogro ul : feedRepository.feedLogros(seguidos, lim)) {
            todos.add(itemLogro(ul));
        }
        for (Torneo t : feedRepository.feedTorneos(seguidos, EstadoRevision.APROBADO, lim)) {
            if (t.getFechaCreacion() == null) continue;
            todos.add(itemTorneo(t));
        }

        todos.sort(Comparator.comparing(ActividadItemDto::fecha,
                Comparator.nullsLast(Comparator.reverseOrder())));

        int from = Math.min(p * s, todos.size());
        int to = Math.min(from + s, todos.size());
        boolean hasMore = todos.size() > to;
        return new FeedDto(new ArrayList<>(todos.subList(from, to)), hasMore, true);
    }

    private static void ponAutor(Map<String, Object> payload, Usuario autor) {
        if (autor != null) {
            payload.put("autorUsername", autor.getUsername());
            payload.put("autorAvatarUrl", autor.getAvatarUrl());
        }
    }

    private ActividadItemDto itemVoto(Voto v) {
        Map<String, Object> payload = new LinkedHashMap<>();
        ponAutor(payload, v.getUsuario());
        Personaje pj = v.getPersonaje();
        if (pj != null) {
            payload.put("personajeSlug", pj.getSlug());
            payload.put("personajeNombre", pj.getNombre());
            payload.put("anime", pj.getAnime());
        }
        Enfrentamiento enf = v.getEnfrentamiento();
        if (enf != null) {
            Personaje oponente = null;
            if (enf.getPersonaje1() != null && pj != null
                    && !enf.getPersonaje1().getId().equals(pj.getId())) {
                oponente = enf.getPersonaje1();
            } else if (enf.getPersonaje2() != null && pj != null
                    && !enf.getPersonaje2().getId().equals(pj.getId())) {
                oponente = enf.getPersonaje2();
            }
            if (oponente != null) {
                payload.put("oponenteSlug", oponente.getSlug());
                payload.put("oponenteNombre", oponente.getNombre());
            }
            if (enf.getTorneo() != null) {
                payload.put("torneoId", enf.getTorneo().getId());
                payload.put("torneoSlug", enf.getTorneo().getSlug());
                payload.put("torneoNombre", enf.getTorneo().getNombre());
            }
        }
        return new ActividadItemDto("VOTO", v.getFecha(), payload);
    }

    private ActividadItemDto itemLogro(UsuarioLogro ul) {
        Map<String, Object> payload = new HashMap<>();
        ponAutor(payload, ul.getUsuario());
        payload.put("codigo", ul.getLogro().getCodigo());
        payload.put("nombre", ul.getLogro().getNombre());
        payload.put("descripcion", ul.getLogro().getDescripcion());
        payload.put("icono", ul.getLogro().getIcono());
        payload.put("rareza", ul.getLogro().getRareza());
        return new ActividadItemDto("LOGRO", ul.getDesbloqueadoEn(), payload);
    }

    private ActividadItemDto itemTorneo(Torneo t) {
        Map<String, Object> payload = new HashMap<>();
        ponAutor(payload, t.getCreadoPor());
        payload.put("torneoSlug", t.getSlug());
        payload.put("torneoNombre", t.getNombre());
        payload.put("estado", t.getEstado() != null ? t.getEstado().name() : null);
        payload.put("estadoRevision", t.getEstadoRevision() != null ? t.getEstadoRevision().name() : null);
        return new ActividadItemDto("TORNEO_CREADO", t.getFechaCreacion(), payload);
    }
}
