package com.diegoalegil.animeshowdown.repository;

import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT e FROM Enfrentamiento e
            WHERE e.id = :id
            """)
    Optional<Enfrentamiento> findByIdForUpdate(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT e FROM Enfrentamiento e
            WHERE e.torneo = :torneo
            ORDER BY e.ronda ASC, e.id ASC
            """)
    List<Enfrentamiento> findByTorneoForUpdateOrderByRondaAscIdAsc(@Param("torneo") Torneo torneo);

    /**
     * query batch para evitar N+1 en TorneoQueryService
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
     * §DB-001: variante con JOIN FETCH de personaje1/2/ganador para el detalle de
     * UN torneo. findByTorneoOrderByRondaAscIdAsc no hace fetch y disparaba N+1
     * (una query por personaje distinto del bracket) en TorneoQueryService.toDetalle.
     */
    @Query("""
            SELECT e FROM Enfrentamiento e
            LEFT JOIN FETCH e.personaje1
            LEFT JOIN FETCH e.personaje2
            LEFT JOIN FETCH e.ganador
            WHERE e.torneo = :torneo
            ORDER BY e.ronda ASC, e.id ASC
            """)
    List<Enfrentamiento> findByTorneoOrderedFetch(@Param("torneo") Torneo torneo);

    @Query(value = """
            SELECT COALESCE(MAX(e.id), 0) FROM enfrentamientos e
            JOIN torneos t ON e.torneo_id = t.id
            WHERE t.estado = 'IN_PROGRESS'
              AND e.personaje1_id IS NOT NULL
              AND e.personaje2_id IS NOT NULL
              AND e.ganador_id IS NULL
            """, nativeQuery = true)
    long maxIdEnfrentamientoAbierto();

    @Query(value = """
            SELECT e.* FROM enfrentamientos e
            JOIN torneos t ON e.torneo_id = t.id
            WHERE t.estado = 'IN_PROGRESS'
              AND e.personaje1_id IS NOT NULL
              AND e.personaje2_id IS NOT NULL
              AND e.ganador_id IS NULL
              AND e.id >= :cursorId
              AND (:excludeIdsSize = 0 OR e.id NOT IN (:excludeIds))
              AND (:usuarioId IS NULL OR NOT EXISTS (
                    SELECT 1 FROM votos v
                    WHERE v.enfrentamiento_id = e.id
                      AND v.usuario_id = :usuarioId
              ))
              AND (:anonSessionId IS NULL OR NOT EXISTS (
                    SELECT 1 FROM votos v
                    WHERE v.enfrentamiento_id = e.id
                      AND v.anon_session_id = :anonSessionId
              ))
            ORDER BY e.id ASC
            LIMIT 1
            """, nativeQuery = true)
    Optional<Enfrentamiento> findSiguienteAbiertoDesde(
            @Param("cursorId") long cursorId,
            @Param("usuarioId") Long usuarioId,
            @Param("anonSessionId") String anonSessionId,
            @Param("excludeIds") List<Long> excludeIds,
            @Param("excludeIdsSize") int excludeIdsSize);

    @Query(value = """
            SELECT e.* FROM enfrentamientos e
            JOIN torneos t ON e.torneo_id = t.id
            WHERE t.estado = 'IN_PROGRESS'
              AND e.personaje1_id IS NOT NULL
              AND e.personaje2_id IS NOT NULL
              AND e.ganador_id IS NULL
              AND e.id < :cursorId
              AND (:excludeIdsSize = 0 OR e.id NOT IN (:excludeIds))
              AND (:usuarioId IS NULL OR NOT EXISTS (
                    SELECT 1 FROM votos v
                    WHERE v.enfrentamiento_id = e.id
                      AND v.usuario_id = :usuarioId
              ))
              AND (:anonSessionId IS NULL OR NOT EXISTS (
                    SELECT 1 FROM votos v
                    WHERE v.enfrentamiento_id = e.id
                      AND v.anon_session_id = :anonSessionId
              ))
            ORDER BY e.id ASC
            LIMIT 1
            """, nativeQuery = true)
    Optional<Enfrentamiento> findSiguienteAbiertoAntes(
            @Param("cursorId") long cursorId,
            @Param("usuarioId") Long usuarioId,
            @Param("anonSessionId") String anonSessionId,
            @Param("excludeIds") List<Long> excludeIds,
            @Param("excludeIdsSize") int excludeIdsSize);

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
     * <p>Consumido por /api/personajes/{slug}/duelos-recientes — "Últimos duelos" en la
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
