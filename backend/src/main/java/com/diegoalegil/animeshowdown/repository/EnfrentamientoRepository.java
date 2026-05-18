package com.diegoalegil.animeshowdown.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.Torneo;

public interface EnfrentamientoRepository extends JpaRepository<Enfrentamiento, Long> {

    List<Enfrentamiento> findByTorneo(Torneo torneo);

    /**
     * Bracket completo del torneo en orden de presentación: primero ronda 1
     * (octavos), luego ronda 2 (cuartos), etc. Dentro de cada ronda el orden
     * es por id ascendente (orden de inserción = orden del bracket de
     * arriba abajo). Resuelto por idx_enf_torneo_ronda sin sort en memoria.
     */
    List<Enfrentamiento> findByTorneoOrderByRondaAscIdAsc(Torneo torneo);

    /**
     * Audit (2026-05-17): query batch para evitar N+1 en TorneoQueryService
     * .listarResumenes — antes hacía findByTorneoOrderBy... por CADA torneo
     * visible (1 + N queries con N≈50 torneos). Esta query trae todos los
     * enfrentamientos de los torneos pedidos en UNA sola, con JOIN FETCH
     * de personajes para que el mapeo a DTO no dispare lazy load adicional.
     */
    @Query("""
            SELECT e FROM Enfrentamiento e
            LEFT JOIN FETCH e.personaje1
            LEFT JOIN FETCH e.personaje2
            LEFT JOIN FETCH e.ganador
            WHERE e.torneo.id IN :torneoIds
            ORDER BY e.torneo.id ASC, e.ronda ASC, e.id ASC
            """)
    List<Enfrentamiento> findByTorneoIdInOrdered(@Param("torneoIds") List<Long> torneoIds);

    /**
     * Devuelve un enfrentamiento aleatorio "abierto" (ambos personajes
     * presentes y sin ganador) de cualquier torneo en estado IN_PROGRESS.
     * Usado por VotarPage modo backend: el usuario vota un match real
     * sin tener que elegir torneo manualmente.
     *
     * ORDER BY RANDOM() es O(n log n) sobre n filas. Para los tamaños
     * realistas del proyecto (cientos de matches abiertos como máximo)
     * es perfectamente aceptable — Postgres lo resuelve <5ms. Cuando
     * llegue Bloque 9 (Battle Royale) con miles de matches/min, se
     * puede cambiar a una estrategia con OFFSET aleatorio.
     */
    @Query(value = """
            SELECT * FROM enfrentamientos e
            JOIN torneos t ON e.torneo_id = t.id
            WHERE t.estado = 'IN_PROGRESS'
              AND e.personaje1_id IS NOT NULL
              AND e.personaje2_id IS NOT NULL
              AND e.ganador_id IS NULL
            ORDER BY RANDOM()
            LIMIT 1
            """, nativeQuery = true)
    Optional<Enfrentamiento> findEnfrentamientoAbiertoAleatorio();

    /**
     * Borra todos los enfrentamientos donde el personaje participe como
     * personaje1, personaje2 o ganador. Devuelve cuántos se borraron.
     * Los votos asociados deben borrarse ANTES (FK constraint), usa
     * VotoRepository.deleteVotosEnEnfrentamientosDelPersonaje.
     */
    @Modifying
    @Query("""
            DELETE FROM Enfrentamiento e
            WHERE e.personaje1.id = :personajeId
               OR e.personaje2.id = :personajeId
               OR e.ganador.id = :personajeId
            """)
    int deleteByPersonajeId(@Param("personajeId") Long personajeId);

    /**
     * Historial de enfrentamientos donde el personaje participó (como
     * personaje1 o personaje2), incluidos los aún sin ganador (PENDING),
     * ordenados por fecha descendente. JOIN FETCH para evitar N+1 cuando
     * el caller mapea a DueloRecienteDto.
     *
     * <p>Plan producto (2026-05-18): consumido por
     * /api/personajes/{slug}/duelos-recientes — "Últimos duelos" en la
     * ficha. Pageable acota a un puñado de items.
     */
    @Query("""
            SELECT e FROM Enfrentamiento e
            LEFT JOIN FETCH e.personaje1
            LEFT JOIN FETCH e.personaje2
            LEFT JOIN FETCH e.ganador
            LEFT JOIN FETCH e.torneo
            WHERE e.personaje1.id = :personajeId
               OR e.personaje2.id = :personajeId
            ORDER BY e.fechaCreacion DESC, e.id DESC
            """)
    List<Enfrentamiento> findHistorialPorPersonaje(
            @Param("personajeId") Long personajeId,
            org.springframework.data.domain.Pageable pageable);

    /**
     * Enfrentamientos DECIDIDOS (ganador != null) en los que participó
     * el personaje. Usado por PersonajeMatchupService para agregar
     * mejores/peores/frecuentes rivales — necesitamos solo los resueltos
     * porque sin ganador no se puede contar W/L.
     *
     * <p>Sin paginación: si un personaje tiene 5.000 duelos resueltos
     * los traemos todos para agregar. En el rango realista del proyecto
     * (cientos máximo por personaje top), es asumible.
     */
    @Query("""
            SELECT e FROM Enfrentamiento e
            LEFT JOIN FETCH e.personaje1
            LEFT JOIN FETCH e.personaje2
            LEFT JOIN FETCH e.ganador
            WHERE e.ganador IS NOT NULL
              AND (e.personaje1.id = :personajeId OR e.personaje2.id = :personajeId)
            """)
    List<Enfrentamiento> findDecididosPorPersonaje(@Param("personajeId") Long personajeId);
}
