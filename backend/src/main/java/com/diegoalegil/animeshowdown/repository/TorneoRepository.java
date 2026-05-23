package com.diegoalegil.animeshowdown.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.EstadoRevision;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;

public interface TorneoRepository extends JpaRepository<Torneo, Long> {

    /** Lookup por slug URL-safe — usado por el endpoint público GET /api/torneos/slug/{slug}. */
    Optional<Torneo> findBySlug(String slug);

    /** Existencia rápida sin cargar la entidad. Útil para el sufijo numérico de unicidad. */
    boolean existsBySlug(String slug);

    /**
     * Torneos cuyo prefijo de descripción coincida con el dado (típicamente
     * "[AUTO]"), filtrados por fechaCreacion posterior al umbral. Reemplaza
     * findAll().stream().filter() en TorneoAutoService que leía la tabla
     * entera y filtraba en memoria — con miles de torneos eso sería un
     * desastre. La query la resuelve Postgres usando el índice de
     * fechaCreacion.
     */
    @Query("""
            SELECT t FROM Torneo t
            WHERE t.descripcion LIKE CONCAT(:prefix, '%')
              AND t.fechaCreacion > :desde
            ORDER BY t.fechaCreacion DESC
            """)
    List<Torneo> findAutoTorneosDesde(
            @Param("prefix") String prefix,
            @Param("desde") LocalDateTime desde);

    /** Cuenta total de torneos con un prefijo concreto en la descripción. */
    @Query("SELECT COUNT(t) FROM Torneo t WHERE t.descripcion LIKE CONCAT(:prefix, '%')")
    long countByDescripcionPrefix(@Param("prefix") String prefix);

    /** Atajo a findAutoTorneosDesde con LIMIT lógico 1 (el más reciente). */
    default Optional<Torneo> findAutoTorneoMasRecienteDesde(String prefix, LocalDateTime desde) {
        List<Torneo> resultados = findAutoTorneosDesde(prefix, desde);
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
            WHERE t.estadoRevision IN (
                com.diegoalegil.animeshowdown.model.EstadoRevision.NO_APLICA,
                com.diegoalegil.animeshowdown.model.EstadoRevision.APROBADO)
              AND t.publico = true
            """)
    List<Torneo> findVisiblesPublico();

    /** Cola admin: pendientes en orden de llegada (FIFO). */
    List<Torneo> findByEstadoRevisionOrderByFechaCreacionAsc(EstadoRevision estado);

    /** Listado del propio creador, todos los estados, más recientes primero. */
    List<Torneo> findByCreadoPorOrderByFechaCreacionDesc(Usuario creador);

    /** Count de torneos UGC creados por un usuario. Plan v2 §4.1 stats perfil. */
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
