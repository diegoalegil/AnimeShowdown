package com.diegoalegil.animeshowdown.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.dto.CartaCatalogoItem;
import com.diegoalegil.animeshowdown.model.Carta;
import com.diegoalegil.animeshowdown.model.RarezaCarta;

public interface CartaRepository extends JpaRepository<Carta, Long> {

    /** Catálogo completo con el personaje cargado (para pintar la colección). */
    @EntityGraph(attributePaths = "personaje")
    List<Carta> findAllByOrderByIdAsc();

    /** Proyección estable del catálogo para cachear sin hidratar entidades. */
    @Query("""
            select new com.diegoalegil.animeshowdown.dto.CartaCatalogoItem(
                c.id,
                p.id,
                p.slug,
                p.nombre,
                p.anime,
                p.imagenUrl,
                p.imagenColorDominante,
                c.rareza,
                c.especialCurada,
                c.variante,
                c.arteUrl)
            from Carta c join c.personaje p
            order by c.id asc
            """)
    List<CartaCatalogoItem> findCatalogoItems();

    /** Una carta por id con el personaje cargado (reveal del sobre). */
    @Override
    @EntityGraph(attributePaths = "personaje")
    Optional<Carta> findById(Long id);

    /** Idempotencia del seed del catálogo: ¿ya existe la carta de este personaje+rareza? */
    boolean existsByPersonajeIdAndRareza(Long personajeId, RarezaCarta rareza);

    /** Idempotencia del seed F2: personaje + rareza + variante. */
    boolean existsByPersonajeIdAndRarezaAndVariante(Long personajeId, RarezaCarta rareza, String variante);

    /** Tamaño del pool de una rareza (odds transparentes). */
    long countByRareza(RarezaCarta rareza);

    /**
     * IDs de {@code limit} cartas de una rareza elegidas AL AZAR en la BBDD
     * ({@code ORDER BY RANDOM() LIMIT}). Evita cargar el pool completo en
     * memoria y barajarlo: el catálogo crece a miles de cartas, así que el
     * muestreo debe ser O(limit), no O(N). H2 (MODE=PostgreSQL) traduce
     * {@code RANDOM()} a {@code RAND()}. La rareza se pasa como String (la
     * columna es VARCHAR por {@code @Enumerated(STRING)}).
     */
    @Query(value = "SELECT id FROM carta WHERE rareza = :rareza ORDER BY RANDOM() LIMIT :limit",
            nativeQuery = true)
    List<Long> findRandomIdsByRareza(@Param("rareza") String rareza, @Param("limit") int limit);

    /** ID de una carta ESPECIAL curada al azar (clímax), o null si no hay ninguna. */
    @Query(value = "SELECT id FROM carta WHERE rareza = :rareza AND especial_curada = TRUE "
            + "ORDER BY RANDOM() LIMIT 1", nativeQuery = true)
    Long findRandomEspecialCuradaId(@Param("rareza") String rareza);

    /** IDs de personaje que ya tienen carta de esta rareza (diff del seed). */
    @Query("select c.personaje.id from Carta c where c.rareza = ?1")
    List<Long> findPersonajeIdsByRareza(RarezaCarta rareza);

    @EntityGraph(attributePaths = "personaje")
    Optional<Carta> findByPersonajeSlugAndRarezaAndVariante(String slug, RarezaCarta rareza, String variante);

    /**
     * Carta especial de un personaje SIN exigir variante vacía: los premios de
     * evento fallaban con personajes cuya ESPECIAL tiene variante no vacía
     * (p.ej. ":6-caminos"). Ordena por variante ascendente, así prefiere la base
     * ("") si existe y, si no, la primera variante de forma determinista.
     */
    @EntityGraph(attributePaths = "personaje")
    Optional<Carta> findFirstByPersonajeSlugAndRarezaOrderByVarianteAsc(String slug, RarezaCarta rareza);
}
