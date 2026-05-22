package com.diegoalegil.animeshowdown.service;

import java.sql.SQLException;
import java.text.Normalizer;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

import javax.sql.DataSource;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import com.diegoalegil.animeshowdown.dto.PersonajeBusquedaDto;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

@Service
public class PersonajeBusquedaService {

    private final PersonajeRepository personajeRepository;
    private final DataSource dataSource;
    private volatile Boolean postgres;

    @PersistenceContext
    private EntityManager entityManager;

    public PersonajeBusquedaService(PersonajeRepository personajeRepository, DataSource dataSource) {
        this.personajeRepository = personajeRepository;
        this.dataSource = dataSource;
    }

    @Cacheable(value = "personajes-busqueda", key = "#q + ':' + #limit")
    public List<PersonajeBusquedaDto> buscar(String q, int limit) {
        String query = q == null ? "" : q.trim();
        if (query.length() < 2) {
            return List.of();
        }
        int saneLimit = Math.max(1, Math.min(25, limit));
        if (isPostgres()) {
            try {
                return buscarPostgres(query, saneLimit);
            } catch (RuntimeException ex) {
                // Fallback defensivo para tests/preview si una función FTS no
                // está disponible. La ruta H2 sigue probando el contrato.
            }
        }
        return buscarFallback(query, saneLimit);
    }

    private List<PersonajeBusquedaDto> buscarPostgres(String query, int limit) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                SELECT
                    p.id,
                    p.slug,
                    p.nombre,
                    p.anime,
                    p.descripcion,
                    p.imagen_url,
                    p.imagen_color_dominante,
                    (
                        CASE WHEN lower(p.nombre) = lower(:q) THEN 100 ELSE 0 END +
                        CASE WHEN lower(p.nombre) LIKE lower(:prefix) THEN 50 ELSE 0 END +
                        CASE WHEN lower(p.nombre) LIKE lower(:like) THEN 25 ELSE 0 END +
                        CASE WHEN lower(p.anime) LIKE lower(:like) THEN 15 ELSE 0 END +
                        CASE WHEN lower(coalesce(p.descripcion, '')) LIKE lower(:like) THEN 5 ELSE 0 END +
                        ts_rank_cd(
                            to_tsvector('simple', coalesce(p.nombre, '') || ' ' || coalesce(p.anime, '') || ' ' || coalesce(p.descripcion, '')),
                            plainto_tsquery('simple', :q)
                        ) * 10
                    ) AS score
                FROM personajes p
                WHERE to_tsvector('simple', coalesce(p.nombre, '') || ' ' || coalesce(p.anime, '') || ' ' || coalesce(p.descripcion, ''))
                      @@ plainto_tsquery('simple', :q)
                   OR lower(p.nombre) LIKE lower(:like)
                   OR lower(p.anime) LIKE lower(:like)
                   OR lower(coalesce(p.descripcion, '')) LIKE lower(:like)
                ORDER BY score DESC, p.nombre ASC
                LIMIT :limit
                """)
                .setParameter("q", query)
                .setParameter("prefix", query + "%")
                .setParameter("like", "%" + query + "%")
                .setParameter("limit", limit)
                .getResultList();

        return rows.stream()
                .map(row -> new PersonajeBusquedaDto(
                        ((Number) row[0]).longValue(),
                        (String) row[1],
                        (String) row[2],
                        (String) row[3],
                        (String) row[4],
                        (String) row[5],
                        (String) row[6],
                        ((Number) row[7]).doubleValue()))
                .toList();
    }

    private List<PersonajeBusquedaDto> buscarFallback(String query, int limit) {
        return personajeRepository.buscarTexto(query).stream()
                .map(p -> PersonajeBusquedaDto.from(p, scoreFallback(p, query)))
                .sorted(Comparator.comparingDouble(PersonajeBusquedaDto::getScore).reversed()
                        .thenComparing(PersonajeBusquedaDto::getNombre))
                .limit(limit)
                .toList();
    }

    private double scoreFallback(Personaje p, String query) {
        String q = normalizar(query);
        String nombre = normalizar(p.getNombre());
        String anime = normalizar(p.getAnime());
        String descripcion = normalizar(p.getDescripcion());
        double score = 0;
        if (nombre.equals(q)) score += 100;
        if (nombre.startsWith(q)) score += 50;
        if (nombre.contains(q)) score += 25;
        if (anime.contains(q)) score += 15;
        if (descripcion.contains(q)) score += 5;
        return score;
    }

    private String normalizar(String value) {
        if (value == null) return "";
        String lower = value.toLowerCase(Locale.ROOT);
        return Normalizer.normalize(lower, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
    }

    private boolean isPostgres() {
        Boolean cached = postgres;
        if (cached != null) {
            return cached;
        }
        try (var connection = dataSource.getConnection()) {
            postgres = connection.getMetaData().getDatabaseProductName()
                    .toLowerCase(Locale.ROOT)
                    .contains("postgres");
        } catch (SQLException ex) {
            postgres = false;
        }
        return postgres;
    }
}
