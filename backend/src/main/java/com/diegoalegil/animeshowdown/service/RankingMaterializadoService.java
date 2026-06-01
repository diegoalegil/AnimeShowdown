package com.diegoalegil.animeshowdown.service;

import java.sql.Date;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.RankingItem;

@Service
public class RankingMaterializadoService {

    private static final int LIMITE_MAXIMO = 5000;

    private final JdbcTemplate jdbcTemplate;

    public RankingMaterializadoService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
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
