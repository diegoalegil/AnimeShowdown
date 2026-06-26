package com.diegoalegil.animeshowdown.repository;

import java.util.List;
import java.util.Optional;
import java.util.Collection;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.dto.PersonajeCatalogoDto;

public interface PersonajeRepository extends JpaRepository<Personaje, Long> {

    List<Personaje> findByAnime(String anime);

    List<Personaje> findByAnimeIn(Collection<String> animes);

    /** Personajes de una categoría (husbando, villain, waifu, …) — une con
     *  personaje_categoria (V80). Devuelve [] si la categoría no tiene mapeos. */
    @Query(value = """
            SELECT p.* FROM personajes p
            JOIN personaje_categoria pc ON pc.personaje_slug = p.slug
            WHERE pc.categoria = :categoria
            """, nativeQuery = true)
    List<Personaje> findByCategoria(@Param("categoria") String categoria);

    Page<Personaje> findByAnime(String anime, Pageable pageable);

    @Query("SELECT p FROM Personaje p ORDER BY p.slug ASC")
    List<Personaje> findAllOrderBySlug();

    @Query("""
            SELECT new com.diegoalegil.animeshowdown.dto.PersonajeCatalogoDto(
                p.id,
                p.slug,
                p.nombre,
                p.anime,
                p.descripcion,
                p.imagenUrl,
                p.imagenColorDominante
            )
            FROM Personaje p
            ORDER BY p.slug ASC
            """)
    List<PersonajeCatalogoDto> findAllCatalogoOrderBySlug();

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

    @Query(value = """
            SELECT *
            FROM personajes
            WHERE slug <> :excludeSlug
            ORDER BY RANDOM()
            LIMIT :tamano
            """,
            nativeQuery = true)
    List<Personaje> findRandomExcluding(@Param("excludeSlug") String excludeSlug,
            @Param("tamano") int tamano);

    /**
     * Proyección lightweight de personajes que NO son de un anime.
     * Excluye el target de la recomendación y cualquier personaje del
     * mismo universo. Solo devuelve los campos necesarios para el DTO
     * (id, slug, nombre, anime, imagenUrl) — sin descripcion, elo, etc.
     */
    @Query("SELECT p FROM Personaje p WHERE p.anime <> :anime")
    List<Personaje> findByAnimeNot(@Param("anime") String anime);

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

}
