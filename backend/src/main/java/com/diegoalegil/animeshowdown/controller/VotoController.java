package com.diegoalegil.animeshowdown.controller;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.RankingItem;
import com.diegoalegil.animeshowdown.dto.RankingMovimientoItem;
import com.diegoalegil.animeshowdown.dto.VotoFeedItem;
import com.diegoalegil.animeshowdown.model.CategoriaVoto;
import com.diegoalegil.animeshowdown.repository.VotoRepository;
import com.diegoalegil.animeshowdown.service.AnimeShowdownMetrics;
import com.diegoalegil.animeshowdown.service.RankingMaterializadoService;
import com.diegoalegil.animeshowdown.service.RankingMovimientosService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/votos")
@Tag(name = "Votos y ranking", description = "Rankings comunitarios por votos: all-time, segmentado, ELO canónico y movimientos.")
public class VotoController {

    private static final int MAX_LIMIT = 200;
    private static final int FULL_RANKING_LIMIT = 5000;

    private final VotoRepository votoRepository;
    private final RankingMaterializadoService rankingMaterializadoService;
    private final RankingMovimientosService rankingMovimientosService;
    private final AnimeShowdownMetrics metrics;

    public VotoController(VotoRepository votoRepository,
            RankingMaterializadoService rankingMaterializadoService,
            RankingMovimientosService rankingMovimientosService,
            AnimeShowdownMetrics metrics) {
        this.votoRepository = votoRepository;
        this.rankingMaterializadoService = rankingMaterializadoService;
        this.rankingMovimientosService = rankingMovimientosService;
        this.metrics = metrics;
    }

    /**
     * Ranking all-time, formato lista plana sin paginación.
     * Compat: lo consume RankingPage del frontend desde el bloque 1.
     */
    @GetMapping("/ranking")
    @Cacheable(value = "votos-ranking")
    @Operation(summary = "Ranking all-time",
            description = "Público. Ranking comunitario completo por votos, lista plana sin paginar (cacheado).")
    public List<RankingItem> obtenerRanking() {
        return metrics.recordRanking(() -> rankingMaterializadoService.rankingAllTime(FULL_RANKING_LIMIT));
    }

    /**
     * ELO canónico por slug de TODO el catálogo (semilla por popularidad +15%
     * femenino + ajuste por votos). Lo consume la pestaña ELO de /ranking para
     * mostrar el ELO real en vez del estimado sintético del cliente. Público y
     * cacheado (mismo TTL que el ranking).
     */
    @GetMapping("/ranking/elo-canonico")
    @Cacheable(value = "votos-ranking", key = "'elo-canonico'")
    public Map<String, Integer> eloCanonico() {
        return rankingMaterializadoService.eloCanonicoPorSlug();
    }

    /**
     * Feed público de los últimos N votos.
     *
     * <p>Pensado para la home (SectionPulso): pintar "hace 3 min @user
     * votó por Luffy frente a Zoro" y dar señal real de comunidad activa.
     * Sin auth — es transparencia pública, igual que el ranking.
     *
     * <p>limit se acota a [1, 20] para no permitir traer toda la tabla
     * con un query string trivial.
     */
    @GetMapping("/recientes")
    public List<VotoFeedItem> votosRecientes(
            @RequestParam(defaultValue = "10") int limit) {
        int sane = Math.max(1, Math.min(20, limit));
        return votoRepository.findRecentesParaFeed(PageRequest.of(0, sane)).stream()
                .map(VotoFeedItem::from)
                .toList();
    }

    /**
     * Ranking actual con indicadores de movimiento.
     *
     * <p>Compara la posición de cada personaje en el top-N actual contra
     * su posición en el ranking de hace {@code dias} días. Devuelve
     * delta (positivo si subió), null si era nuevo en el ranking.
     */
    @GetMapping("/ranking/movimientos")
    public List<RankingMovimientoItem> rankingMovimientos(
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "7") int dias) {
        return rankingMovimientosService.calcular(limit, dias);
    }

    /**
     * Ranking segmentado.
     *
     * <ul>
     *   <li>{@code periodo=all|mes|trimestre|anio} — ventana temporal sobre
     *       Voto.fecha. Default 'all' (= all-time).</li>
     *   <li>{@code anime=<nombre>} — filtra por personaje.anime. Si está
     *       presente toma precedencia y devuelve solo personajes de ese
     *       anime.</li>
     *   <li>{@code categoria=<id>} — intención de voto (feature #15): 'poder',
     *       'mejor-villano'… Filtra por votos de esa categoría, honrando
     *       {@code periodo} (p.ej. "Top Poder este mes"). Una categoría
     *       inválida/blank se IGNORA y cae a la rama de periodo (nunca 400).</li>
     *   <li>{@code limit=N} — máx 200, default 50.</li>
     * </ul>
     *
     * <p>Precedencia: {@code anime} &gt; {@code categoria} &gt; {@code periodo}.
     * {@code anime} mantiene la máxima prioridad (contrato existente, sin
     * cambios); {@code categoria} es puramente aditivo.
     */
    @GetMapping("/ranking/segmentado")
    public ResponseEntity<List<RankingItem>> rankingSegmentado(
            @RequestParam(defaultValue = "all") String periodo,
            @RequestParam(required = false) String anime,
            @RequestParam(required = false) String categoria,
            @RequestParam(defaultValue = "50") int limit) {
        int saneLimit = Math.min(MAX_LIMIT, Math.max(1, limit));

        if (anime != null && !anime.isBlank()) {
            return metrics.recordRanking(() ->
                    ResponseEntity.ok(rankingMaterializadoService.rankingPorAnime(anime, saneLimit)));
        }

        LocalDateTime desde = switch (periodo == null ? "all" : periodo.toLowerCase()) {
            case "mes" -> LocalDateTime.now().minusDays(30);
            case "trimestre" -> LocalDateTime.now().minusDays(90);
            case "anio", "año" -> LocalDateTime.now().minusDays(365);
            default -> null; // all-time
        };

        // Intención de voto (feature #15). fromId tolera blank/desconocido →
        // null, en cuyo caso ignoramos el filtro y caemos a la rama de periodo
        // de toda la vida (sin 400). Si es válida, filtra por categoría
        // honrando la ventana temporal.
        CategoriaVoto cat = CategoriaVoto.fromId(categoria);
        if (cat != null) {
            // Cacheado 30s en RankingMaterializadoService (key por etiqueta de
            // periodo, no por el timestamp `desde`). Antes pegaba un GROUP BY en
            // vivo sobre `votos` en cada request del mismo combo.
            String periodoKey = periodo == null ? "all" : periodo.toLowerCase();
            return metrics.recordRanking(() -> ResponseEntity.ok(
                    rankingMaterializadoService.rankingPorCategoria(cat.getId(), periodoKey, desde, saneLimit)));
        }

        if (desde == null) {
            return metrics.recordRanking(() -> ResponseEntity.ok(
                    rankingMaterializadoService.rankingAllTime(saneLimit)));
        }
        return metrics.recordRanking(() ->
                ResponseEntity.ok(rankingMaterializadoService.rankingDesde(desde, saneLimit)));
    }

    /**
     * Lista de animes que han recibido al menos un voto. Útil para el
     * dropdown "Por anime" en /ranking. 6.
     */
    @GetMapping("/ranking/animes-disponibles")
    public List<String> animesConVotos() {
        return rankingMaterializadoService.animesConVotos();
    }

    /**
     * Lista de categorías de intención (feature #15) con al menos un voto, como
     * ids de wire ('poder', 'mejor-villano'…). Pobla el sub-selector "Por
     * intención" en /ranking sin pintar categorías vacías.
     */
    @GetMapping("/ranking/categorias-disponibles")
    @Cacheable(value = "votos-categorias-disponibles")
    public List<String> categoriasConVotos() {
        return votoRepository.categoriasConVotos();
    }

    /**
     * Top voters — leaderboard de los usuarios que más
     * han votado. Periodo: all|semana|mes. Sin auth — es transparencia
     * pública del engagement del sitio.
     *
     * <p>Devuelve DTO mínimo {username, avatarUrl, votos} para no
     * exponer email u otros campos privados.
     */
    @GetMapping("/top-voters")
    @Cacheable(value = "votos-top-voters",
            key = "#periodo + ':' + T(java.lang.Math).max(1, T(java.lang.Math).min(50, #limit))")
    public List<java.util.Map<String, Object>> topVoters(
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "all") String periodo,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "10") int limit) {
        int saneLimit = Math.max(1, Math.min(50, limit));
        org.springframework.data.domain.Pageable pg = org.springframework.data.domain.PageRequest.of(
                0, saneLimit);
        List<com.diegoalegil.animeshowdown.dto.TopVoterItem> filas;
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
                .map((fila) -> java.util.Map.<String, Object>of(
                        "username", fila.username(),
                        "avatarUrl", fila.avatarUrl() == null ? "" : fila.avatarUrl(),
                        "votos", fila.votos()))
                .toList();
    }
}
