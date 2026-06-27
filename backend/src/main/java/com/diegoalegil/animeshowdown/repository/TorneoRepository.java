package com.diegoalegil.animeshowdown.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.EstadoRevision;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;

import jakarta.persistence.LockModeType;

public interface TorneoRepository extends JpaRepository<Torneo, Long> {

    /** Lookup por slug URL-safe — usado por el endpoint público GET /api/torneos/slug/{slug}. */
    Optional<Torneo> findBySlug(String slug);

    /**
     * Como findBySlug pero con JOIN FETCH del ganadorPersonaje. Para
     * OgImageService.renderTorneo, que NO es @Transactional (es @Cacheable) y
     * lee t.getGanadorPersonaje() fuera de sesión: con esa asociación en LAZY y
     * open-in-view=false, sin este fetch lanzaría LazyInitializationException.
     */
    @Query("SELECT t FROM Torneo t LEFT JOIN FETCH t.ganadorPersonaje WHERE t.slug = :slug")
    Optional<Torneo> findBySlugFetchGanador(@Param("slug") String slug);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM Torneo t WHERE t.id = :id")
    Optional<Torneo> findForUpdateById(@Param("id") Long id);

    /** Existencia rápida sin cargar la entidad. Útil para el sufijo numérico de unicidad. */
    boolean existsBySlug(String slug);

    /**
     * Torneos automáticos identificados por prefijo de nombre público
     * ("Random Showdown #"), filtrados por fechaCreacion posterior al umbral.
     * Reemplaza findAll().stream().filter() en TorneoAutoService que leía la
     * tabla entera y filtraba en memoria.
     */
    @Query("""
            SELECT t FROM Torneo t
            WHERE t.nombre LIKE CONCAT(:prefix, '%')
              AND t.fechaCreacion > :desde
            ORDER BY t.fechaCreacion DESC
            """)
    List<Torneo> findTorneosPorNombrePrefixDesde(
            @Param("prefix") String prefix,
            @Param("desde") LocalDateTime desde);

    /** Cuenta total de torneos con un prefijo concreto en el nombre. */
    @Query("SELECT COUNT(t) FROM Torneo t WHERE t.nombre LIKE CONCAT(:prefix, '%')")
    long countByNombrePrefix(@Param("prefix") String prefix);

    @Query("""
            SELECT t FROM Torneo t
            WHERE t.autoGenerado = true
              AND t.fechaCreacion > :desde
            ORDER BY t.fechaCreacion DESC
            """)
    List<Torneo> findTorneosAutoGeneradosDesde(@Param("desde") LocalDateTime desde);

    @Query("""
            SELECT COUNT(t) FROM Torneo t
            WHERE t.autoGenerado = true
              AND t.eventoSlug = :eventoSlug
            """)
    long countAutoGeneradosByEventoSlug(@Param("eventoSlug") String eventoSlug);

    /** Atajo a findTorneosPorNombrePrefixDesde con LIMIT lógico 1. */
    default Optional<Torneo> findTorneoMasRecientePorNombrePrefixDesde(String prefix, LocalDateTime desde) {
        List<Torneo> resultados = findTorneosPorNombrePrefixDesde(prefix, desde);
        return resultados.isEmpty() ? Optional.empty() : Optional.of(resultados.get(0));
    }

    default Optional<Torneo> findTorneoAutoMasRecienteDesde(LocalDateTime desde) {
        List<Torneo> resultados = findTorneosAutoGeneradosDesde(desde);
        return resultados.isEmpty() ? Optional.empty() : Optional.of(resultados.get(0));
    }

    /**
     * Listado público: solo torneos visibles para todos — los creados por
     * admin (NO_APLICA) y los aprobados por moderación. Excluye PENDIENTE
     * (en cola) y RECHAZADO (rebotados), que solo son visibles para el
     * creador en "Mis torneos" o para admin en la cola.
     */
    @Query("""
            SELECT t FROM Torneo t
            LEFT JOIN FETCH t.ganadorPersonaje
            LEFT JOIN FETCH t.creadoPor
            WHERE t.estadoRevision IN (
                com.diegoalegil.animeshowdown.model.EstadoRevision.NO_APLICA,
                com.diegoalegil.animeshowdown.model.EstadoRevision.APROBADO)
              AND t.publico = true
            """)
    List<Torneo> findVisiblesPublico();

    /** Cola admin: pendientes en orden de llegada (FIFO). */
    List<Torneo> findByEstadoRevisionOrderByFechaCreacionAsc(EstadoRevision estado);

    @Query("""
            SELECT t.id FROM Torneo t
            WHERE t.estado = com.diegoalegil.animeshowdown.model.EstadoTorneo.IN_PROGRESS
            ORDER BY t.id ASC
            """)
    List<Long> findIdsEnCurso();

    /** Listado del propio creador, todos los estados, más recientes primero. */
    List<Torneo> findByCreadoPorOrderByFechaCreacionDesc(Usuario creador);

    /** Count de torneos UGC creados por un usuario. 1 stats perfil. */
    long countByCreadoPor(Usuario creador);

    /**
     * pone a NULL la FK ganador_personaje_id de los
     * torneos que apuntan al personaje dado. Usado por DataSeeder antes de
     * borrar un personaje retirado del seed — preserva el torneo y sus
     * enfrentamientos/votos históricos, solo pierde la asignación de ganador
     * (que es metadata, recomputable a partir de los votos del bracket).
     * Sin esto, retirar del seed un personaje que ganó un torneo rompe el
     * arranque con constraint violation.
     */
    @Modifying
    @Query("UPDATE Torneo t SET t.ganadorPersonaje = NULL WHERE t.ganadorPersonaje.id = :personajeId")
    int clearGanadorByPersonajeId(@Param("personajeId") Long personajeId);
}
