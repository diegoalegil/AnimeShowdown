package com.diegoalegil.animeshowdown.controller;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.RankingItem;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

@RestController
@RequestMapping("/api/votos")
public class VotoController {

    private static final int MAX_LIMIT = 200;

    private final VotoRepository votoRepository;

    public VotoController(VotoRepository votoRepository) {
        this.votoRepository = votoRepository;
    }

    /**
     * Ranking all-time, formato lista plana sin paginación.
     * Compat: lo consume RankingPage del frontend desde el bloque 1.
     */
    @GetMapping("/ranking")
    public List<RankingItem> obtenerRanking() {
        return votoRepository.obtenerRanking();
    }

    /**
     * Ranking segmentado (Plan v2 §4.6).
     *
     * <ul>
     *   <li>{@code periodo=all|mes|trimestre|anio} — ventana temporal sobre
     *       Voto.fecha. Default 'all' (= all-time).</li>
     *   <li>{@code anime=<nombre>} — filtra por personaje.anime. Si está
     *       presente toma precedencia y devuelve solo personajes de ese
     *       anime.</li>
     *   <li>{@code limit=N} — máx 200, default 50.</li>
     * </ul>
     */
    @GetMapping("/ranking/segmentado")
    public ResponseEntity<List<RankingItem>> rankingSegmentado(
            @RequestParam(defaultValue = "all") String periodo,
            @RequestParam(required = false) String anime,
            @RequestParam(defaultValue = "50") int limit) {
        int saneLimit = Math.min(MAX_LIMIT, Math.max(1, limit));
        var pageable = PageRequest.of(0, saneLimit);

        if (anime != null && !anime.isBlank()) {
            return ResponseEntity.ok(votoRepository.rankingPorAnime(anime, pageable));
        }

        LocalDateTime desde = switch (periodo == null ? "all" : periodo.toLowerCase()) {
            case "mes" -> LocalDateTime.now().minusDays(30);
            case "trimestre" -> LocalDateTime.now().minusDays(90);
            case "anio", "año" -> LocalDateTime.now().minusDays(365);
            default -> null; // all-time
        };

        if (desde == null) {
            return ResponseEntity.ok(
                    votoRepository.rankingAllTime(pageable).getContent());
        }
        return ResponseEntity.ok(votoRepository.rankingDesde(desde, pageable));
    }

    /**
     * Lista de animes que han recibido al menos un voto. Útil para el
     * dropdown "Por anime" en /ranking. Plan v2 §4.6.
     */
    @GetMapping("/ranking/animes-disponibles")
    public List<String> animesConVotos() {
        return votoRepository.animesConVotos();
    }

    /**
     * Top voters (Plan v2 §11.9) — leaderboard de los usuarios que más
     * han votado. Periodo: all|semana|mes. Sin auth — es transparencia
     * pública del engagement del sitio.
     *
     * <p>Devuelve DTO mínimo {username, avatarUrl, votos} para no
     * exponer email u otros campos privados.
     */
    @GetMapping("/top-voters")
    public List<java.util.Map<String, Object>> topVoters(
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "all") String periodo,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "10") int limit) {
        int saneLimit = Math.max(1, Math.min(50, limit));
        org.springframework.data.domain.Pageable pg = org.springframework.data.domain.PageRequest.of(
                0, saneLimit);
        List<Object[]> filas;
        switch (periodo) {
            case "semana":
                filas = votoRepository.topVotersDesde(
                        java.time.LocalDateTime.now().minusDays(7), pg);
                break;
            case "mes":
                filas = votoRepository.topVotersDesde(
                        java.time.LocalDateTime.now().minusDays(30), pg);
                break;
            case "all":
            default:
                filas = votoRepository.topVoters(pg);
        }
        return filas.stream()
                .map((fila) -> {
                    com.diegoalegil.animeshowdown.model.Usuario u =
                            (com.diegoalegil.animeshowdown.model.Usuario) fila[0];
                    Long count = (Long) fila[1];
                    return java.util.Map.<String, Object>of(
                            "username", u.getUsername(),
                            "avatarUrl", u.getAvatarUrl() == null ? "" : u.getAvatarUrl(),
                            "votos", count);
                })
                .toList();
    }
}
