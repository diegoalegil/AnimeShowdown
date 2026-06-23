package com.diegoalegil.animeshowdown.service;

import java.sql.Date;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.RankingItem;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

@Service
public class RankingMaterializadoService {

    private static final int LIMITE_MAXIMO = 5000;
    private static final int ELO_SEMILLA_FALLBACK = 1500;

    private final JdbcTemplate jdbcTemplate;
    private final VotoRepository votoRepository;
    private final double votoPeso;

    public RankingMaterializadoService(JdbcTemplate jdbcTemplate,
            VotoRepository votoRepository,
            @Value("${app.ranking.voto-peso:1.0}") double votoPeso) {
        this.jdbcTemplate = jdbcTemplate;
        this.votoRepository = votoRepository;
        this.votoPeso = votoPeso;
    }

    /**
     * ELO canónico por slug para TODO el catálogo: la base del ranking nuevo.
     * {@code elo = elo_semilla(popularidad + 15% femenino) + votoPeso·peso_votos}.
     * Los votos AJUSTAN la posición desde la semilla (no la aplastan, con
     * votoPeso bajo). Sin semilla → suelo 1500; sin votos → solo la semilla
     * (la tabla no muere a 0 votos). LEFT JOIN para incluir a los no votados.
     * Lo cachea el controller (TTL de votos-ranking).
     */
    @Transactional(readOnly = true)
    public Map<String, Integer> eloCanonicoPorSlug() {
        Map<String, Integer> elos = new LinkedHashMap<>();
        jdbcTemplate.query("""
                SELECT p.slug AS slug,
                       COALESCE(p.elo_semilla, ?) AS semilla,
                       COALESCE(s.peso_votos, 0) AS peso
                FROM personajes p
                LEFT JOIN voto_personaje_stats s ON s.personaje_id = p.id
                """, rs -> {
            int semilla = rs.getInt("semilla");
            double peso = rs.getDouble("peso");
            elos.put(rs.getString("slug"), semilla + (int) Math.round(votoPeso * peso));
        }, ELO_SEMILLA_FALLBACK);
        return elos;
    }

    @Transactional(readOnly = true)
    public List<RankingItem> rankingAllTime(int limit) {
        return jdbcTemplate.query("""
                SELECT p.id, p.slug, p.nombre, p.anime, p.imagen_url,
                       s.votos_score, s.peso_votos
                FROM voto_personaje_stats s
                JOIN personajes p ON p.id = s.personaje_id
                WHERE s.votos_score > 0 OR s.peso_votos > 0
                ORDER BY s.peso_votos DESC, p.id ASC
                LIMIT ?
                """, this::rankingItem, saneLimit(limit));
    }

    @Transactional(readOnly = true)
    public List<RankingItem> rankingPorAnime(String anime, int limit) {
        return jdbcTemplate.query("""
                SELECT p.id, p.slug, p.nombre, p.anime, p.imagen_url,
                       s.votos_score, s.peso_votos
                FROM voto_personaje_stats s
                JOIN personajes p ON p.id = s.personaje_id
                WHERE p.anime = ?
                  AND (s.votos_score > 0 OR s.peso_votos > 0)
                ORDER BY s.peso_votos DESC, p.id ASC
                LIMIT ?
                """, this::rankingItem, anime, saneLimit(limit));
    }

    @Transactional(readOnly = true)
    public List<RankingItem> rankingDesde(LocalDateTime desde, int limit) {
        Date dia = Date.valueOf(desde.toLocalDate());
        return jdbcTemplate.query("""
                SELECT p.id, p.slug, p.nombre, p.anime, p.imagen_url,
                       SUM(s.votos_score) AS votos_score,
                       SUM(s.peso_votos) AS peso_votos
                FROM voto_personaje_dia_stats s
                JOIN personajes p ON p.id = s.personaje_id
                WHERE s.dia >= ?
                GROUP BY p.id, p.slug, p.nombre, p.anime, p.imagen_url
                HAVING SUM(s.votos_score) > 0 OR SUM(s.peso_votos) > 0
                ORDER BY SUM(s.peso_votos) DESC, p.id ASC
                LIMIT ?
                """, this::rankingItem, dia, saneLimit(limit));
    }

    @Transactional(readOnly = true)
    public List<RankingItem> rankingHasta(LocalDateTime antesDe, int limit) {
        Date dia = Date.valueOf(antesDe.toLocalDate());
        return jdbcTemplate.query("""
                SELECT p.id, p.slug, p.nombre, p.anime, p.imagen_url,
                       SUM(s.votos_score) AS votos_score,
                       SUM(s.peso_votos) AS peso_votos
                FROM voto_personaje_dia_stats s
                JOIN personajes p ON p.id = s.personaje_id
                WHERE s.dia < ?
                GROUP BY p.id, p.slug, p.nombre, p.anime, p.imagen_url
                HAVING SUM(s.votos_score) > 0 OR SUM(s.peso_votos) > 0
                ORDER BY SUM(s.peso_votos) DESC, p.id ASC
                LIMIT ?
                """, this::rankingItem, dia, saneLimit(limit));
    }

    /**
     * Ranking por categoría de intención de voto (feature #15), cacheado.
     *
     * <p>A diferencia de las ramas materializadas (stats pre-agregadas), las
     * queries por categoría agregan en vivo con GROUP BY sobre {@code votos} —
     * caras y antes sin cache (se re-ejecutaban en cada request del mismo
     * combo). Se cachean 30s (como {@code votos-ranking}) para absorber hits
     * repetidos. La clave usa la ETIQUETA del periodo ({@code periodoKey}), NO
     * el {@code desde} (viene de {@code now()} y nunca acertaría); {@code desde}
     * solo entra en la query.
     */
    @Cacheable(value = "votos-ranking-categoria", key = "#catId + ':' + #periodoKey + ':' + #limit")
    @Transactional(readOnly = true)
    public List<RankingItem> rankingPorCategoria(String catId, String periodoKey,
            LocalDateTime desde, int limit) {
        var pageable = PageRequest.of(0, saneLimit(limit));
        return desde == null
                ? votoRepository.rankingPorCategoria(catId, pageable)
                : votoRepository.rankingPorCategoriaDesde(catId, desde, pageable);
    }

    @Transactional(readOnly = true)
    public List<String> animesConVotos() {
        return jdbcTemplate.query("""
                SELECT DISTINCT p.anime
                FROM voto_personaje_stats s
                JOIN personajes p ON p.id = s.personaje_id
                WHERE p.anime IS NOT NULL
                  AND p.anime <> ''
                  AND (s.votos_score > 0 OR s.peso_votos > 0)
                ORDER BY p.anime ASC
                """, (rs, rowNum) -> rs.getString("anime"));
    }

    private int saneLimit(int limit) {
        return Math.max(1, Math.min(LIMITE_MAXIMO, limit));
    }

    private RankingItem rankingItem(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        return new RankingItem(
                rs.getLong("id"),
                rs.getString("slug"),
                rs.getString("nombre"),
                rs.getString("anime"),
                rs.getString("imagen_url"),
                rs.getBigDecimal("votos_score").doubleValue(),
                rs.getBigDecimal("peso_votos").doubleValue());
    }
}
