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

    /**
     * Selección aleatoria de N personajes distintos. Delega la ordenación
     * aleatoria a la BBDD (RANDOM()) evitando cargar ~1000 entidades JPA
     * para luego descartar ~990 en memoria — el caso de uso de
     * {@code TorneoAutoService.generar()}.
     *
     * <p>Compatible con PostgreSQL (prod) y H2 (tests). En H2 el dialecto
     * traduce RANDOM() a RAND(); la sintaxis {@code ORDER BY RANDOM()}
     * funciona en ambos.
     */
    @Query(value = "SELECT * FROM personajes ORDER BY RANDOM() LIMIT :tamano",
            nativeQuery = true)
    List<Personaje> findRandom(@Param("tamano") int tamano);

    @Query("SELECT DISTINCT p.anime FROM Personaje p WHERE p.anime IS NOT NULL ORDER BY p.anime ASC")
    List<String> findDistinctAnimes();

    /** Lookup por slug URL-safe — usado por OG image y endpoints públicos. */
    Optional<Personaje> findBySlug(String slug);

    /** Batch lookup por lista de slugs. Sprint 2026-05-18 actividad reciente. */
    List<Personaje> findBySlugIn(java.util.Collection<String> slugs);

    boolean existsByNombre(String nombre);

    /**
     * Proyección column-only para healthcheck: devuelve solo {@code slug},
     * suficiente para detectar drift BBDD↔seed por composición.
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
