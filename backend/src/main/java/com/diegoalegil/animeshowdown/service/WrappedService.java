package com.diegoalegil.animeshowdown.service;

import java.time.LocalDate;
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

    /** Cuántos personajes top exponer en la tarjeta del santuario. */
    private static final int TOP_VISIBLE = 3;

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

        // Top 3 en el orden votos-desc que ya entrega la query, copia defensiva.
        List<TopPersonajeItem> top3 = List.copyOf(
                top.subList(0, Math.min(TOP_VISIBLE, top.size())));

        Fandom fandom = fandomPrincipal(top);
        String fandomNombre = fandom == null ? null : fandom.anime();
        WrappedDto.UniversoTop universoTop = fandom == null ? null
                : new WrappedDto.UniversoTop(fandom.anime(), fandom.slug(), fandom.pct());

        long mejorRacha = mejorRachaDias(votoRepository.fechasDistintasDeVoto(usuario));

        return new WrappedDto(
                usuario.getUsername(),
                votos,
                duelos,
                prediccionesAcertadas,
                badges,
                personajeTop,
                fandomNombre,
                mejorRacha,
                top3,
                universoTop,
                usuario.isWrappedPublico());
    }

    /**
     * Fandom principal del usuario: el anime más frecuente entre sus personajes
     * top, con su cuota (% de los personajes top que tienen anime y pertenecen a
     * ese fandom) y el slug del personaje mejor rankeado de ese anime (para que
     * el frontend resuelva el arte de marca).
     *
     * <p>En empate gana el del personaje mejor rankeado: la lista llega ordenada
     * por votos desc y recorremos con estrictamente-mayor, así que el primero en
     * alcanzar el conteo máximo (el mejor rankeado) se queda. Devuelve null si
     * ningún personaje top tiene anime.
     */
    private Fandom fandomPrincipal(List<TopPersonajeItem> top) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        int totalConAnime = 0;
        for (TopPersonajeItem t : top) {
            if (t.anime() != null && !t.anime().isBlank()) {
                counts.merge(t.anime(), 1, Integer::sum);
                totalConAnime++;
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
        if (mejor == null) {
            return null;
        }
        // Slug del primer (mejor rankeado) personaje del anime ganador.
        String slug = null;
        for (TopPersonajeItem t : top) {
            if (mejor.equals(t.anime())) {
                slug = t.slug();
                break;
            }
        }
        int pct = (int) Math.round(100.0 * mejorCount / totalConAnime);
        return new Fandom(mejor, slug, pct);
    }

    /** Resultado interno del cálculo de fandom: nombre, slug representativo y %. */
    private record Fandom(String anime, String slug, int pct) {
    }

    /**
     * Racha más larga de días-calendario consecutivos, dada una lista de fechas
     * ascendente (idealmente DISTINTA; los duplicados de mismo día se tratan como
     * no-op). Helper PURO y testeable: no consulta la hora actual, opera solo
     * sobre las fechas recibidas. Devuelve 0 para lista vacía/null y 1 para un
     * único día.
     */
    static long mejorRachaDias(List<LocalDate> fechas) {
        if (fechas == null || fechas.isEmpty()) {
            return 0;
        }
        long mejor = 1;
        long actual = 1;
        for (int i = 1; i < fechas.size(); i++) {
            LocalDate prev = fechas.get(i - 1);
            LocalDate cur = fechas.get(i);
            if (cur.equals(prev)) {
                // Mismo día (duplicado): no rompe ni alarga la racha.
                continue;
            }
            if (cur.equals(prev.plusDays(1))) {
                actual++;
                if (actual > mejor) {
                    mejor = actual;
                }
            } else {
                actual = 1;
            }
        }
        return mejor;
    }
}
