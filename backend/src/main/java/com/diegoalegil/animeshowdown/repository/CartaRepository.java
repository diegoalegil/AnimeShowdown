package com.diegoalegil.animeshowdown.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.diegoalegil.animeshowdown.model.Carta;
import com.diegoalegil.animeshowdown.model.RarezaCarta;

public interface CartaRepository extends JpaRepository<Carta, Long> {

    /** Catálogo completo con el personaje cargado (para pintar la colección). */
    @EntityGraph(attributePaths = "personaje")
    List<Carta> findAllByOrderByIdAsc();

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
     * IDs de las cartas de una rareza. El dropper carga sólo los ids (pool de
     * ~700 SSR), elige uno al azar y materializa la carta con findById — evita
     * traer cientos de entidades para abrir un sobre.
     */
    @Query("select c.id from Carta c where c.rareza = ?1")
    List<Long> findIdsByRareza(RarezaCarta rareza);

    @Query("select c.id from Carta c where c.rareza = ?1 and c.especialCurada = true")
    List<Long> findIdsEspecialesCuradas(RarezaCarta rareza);

    /** IDs de personaje que ya tienen carta de esta rareza (diff del seed). */
    @Query("select c.personaje.id from Carta c where c.rareza = ?1")
    List<Long> findPersonajeIdsByRareza(RarezaCarta rareza);

    @EntityGraph(attributePaths = "personaje")
    Optional<Carta> findByPersonajeSlugAndRarezaAndVariante(String slug, RarezaCarta rareza, String variante);

    @EntityGraph(attributePaths = "personaje")
    Optional<Carta> findFirstByPersonajeSlugAndRarezaAndEspecialCuradaTrueOrderByIdAsc(String slug, RarezaCarta rareza);
}
