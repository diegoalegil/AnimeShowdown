package com.diegoalegil.animeshowdown.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.TopPersonajeItem;
import com.diegoalegil.animeshowdown.dto.WrappedDto;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.PrediccionRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioLogroRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

/**
 * Genera el "Wrapped" de un usuario a partir de su actividad real (votos,
 * duelos, predicciones, badges). Reúsa las consultas existentes; se calcula
 * on-demand (no es tráfico alto y evita añadir una caché/migración nuevas).
 */
@Service
public class WrappedService {

    /** Cuántos top personajes inspeccionar para derivar el fandom principal. */
    private static final int TOP_PARA_FANDOM = 20;

    private final VotoRepository votoRepository;
    private final PrediccionRepository prediccionRepository;
    private final UsuarioLogroRepository usuarioLogroRepository;

    public WrappedService(VotoRepository votoRepository,
            PrediccionRepository prediccionRepository,
            UsuarioLogroRepository usuarioLogroRepository) {
        this.votoRepository = votoRepository;
        this.prediccionRepository = prediccionRepository;
        this.usuarioLogroRepository = usuarioLogroRepository;
    }

    @Transactional(readOnly = true)
    public WrappedDto generar(Usuario usuario) {
        long votos = votoRepository.countByUsuario(usuario);
        long duelos = usuario.getPvpPartidos();
        long prediccionesAcertadas = prediccionRepository.countByUsuarioAndAcertadaTrue(usuario);
        long badges = usuarioLogroRepository.countByUsuario(usuario);

        List<TopPersonajeItem> top = votoRepository.topPorUsuario(
                usuario, PageRequest.of(0, TOP_PARA_FANDOM));

        WrappedDto.PersonajeTop personajeTop = top.isEmpty() ? null
                : new WrappedDto.PersonajeTop(
                        top.get(0).slug(), top.get(0).nombre(),
                        top.get(0).anime(), top.get(0).imagenUrl());

        return new WrappedDto(
                usuario.getUsername(),
                votos,
                duelos,
                prediccionesAcertadas,
                badges,
                personajeTop,
                fandomPrincipal(top));
    }

    /**
     * Anime más frecuente entre los personajes top del usuario. En empate gana
     * el del personaje mejor rankeado (la lista llega ordenada por votos desc y
     * recorremos con estrictamente-mayor).
     */
    private String fandomPrincipal(List<TopPersonajeItem> top) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (TopPersonajeItem t : top) {
            if (t.anime() != null && !t.anime().isBlank()) {
                counts.merge(t.anime(), 1, Integer::sum);
            }
        }
        String mejor = null;
        int mejorCount = 0;
        for (Map.Entry<String, Integer> e : counts.entrySet()) {
            if (e.getValue() > mejorCount) {
                mejor = e.getKey();
                mejorCount = e.getValue();
            }
        }
        return mejor;
    }
}
