package com.diegoalegil.animeshowdown.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.dto.PersonajeScoreItem;

public interface PersonajeRepository extends JpaRepository<Personaje, Long> {

    List<Personaje> findByAnime(String anime);

    @Query("SELECT p FROM Personaje p ORDER BY p.slug ASC")
    List<Personaje> findAllOrderBySlug();

    /** Lookup por slug URL-safe — usado por OG image y endpoints públicos. */
    Optional<Personaje> findBySlug(String slug);

    /** Batch lookup por lista de slugs. Sprint 2026-05-18 actividad reciente. */
    List<Personaje> findBySlugIn(java.util.Collection<String> slugs);

    boolean existsByNombre(String nombre);

    /**
     * Proyección column-only para healthcheck (P2 audit 2026-05-17): cargar
     * la entidad completa solo para comparar slugs era desperdicio. Esta
     * query devuelve solo {@code slug}, suficiente para detectar drift
     * BBDD↔seed por composición (no solo por count).
     */
    @Query("SELECT p.slug FROM Personaje p")
    List<String> findAllSlugs();

    @Query("""
            SELECT p
            FROM Personaje p
            WHERE LOWER(p.nombre) LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(p.anime) LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(COALESCE(p.descripcion, '')) LIKE LOWER(CONCAT('%', :q, '%'))
            """)
    List<Personaje> buscarTexto(@Param("q") String q);

    @Query("""
            SELECT new com.diegoalegil.animeshowdown.dto.PersonajeScoreItem(
                p.id,
                p.slug,
                p.nombre,
                p.anime,
                p.imagenUrl,
                COUNT(v),
                COALESCE(SUM(CASE WHEN v.fecha >= :desde THEN 1 ELSE 0 END), 0)
            )
            FROM Personaje p
            LEFT JOIN Voto v ON v.personaje = p
            GROUP BY p.id, p.slug, p.nombre, p.anime, p.imagenUrl
            ORDER BY COUNT(v) DESC, p.id ASC
            """)
    List<PersonajeScoreItem> topConPuntuacionYRecencia(
            @Param("desde") java.time.LocalDateTime desde,
            org.springframework.data.domain.Pageable pageable);
}
