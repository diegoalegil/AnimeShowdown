package com.diegoalegil.animeshowdown.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.dto.RankingItem;
import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.Voto;

public interface VotoRepository extends JpaRepository<Voto, Long> {

    @Query("""
            SELECT new com.diegoalegil.animeshowdown.dto.RankingItem(v.personaje, COUNT(v))
            FROM Voto v
            GROUP BY v.personaje
            ORDER BY COUNT(v) DESC
            """)
    List<RankingItem> obtenerRanking();

    boolean existsByPersonajeAndUsuario(Personaje personaje, Usuario usuario);

    boolean existsByEnfrentamientoAndUsuario(Enfrentamiento enfrentamiento, Usuario usuario);

    /** Total de votos emitidos por un usuario. Plan v2 §4.2 (badges por umbral). */
    long countByUsuario(Usuario usuario);

    long countByEnfrentamientoAndPersonaje(Enfrentamiento enfrentamiento, Personaje personaje);

    /**
     * Conteo agrupado por enfrentamiento dentro de un torneo. Evita N+1
     * cuando TorneoQueryService rellena `totalVotos` en cada match del
     * bracket: una sola query bulk en lugar de countByEnfrentamiento(e)
     * llamado 16 veces por torneo de 16 personajes.
     *
     * Devuelve Object[] {Long enfrentamientoId, Long count} para que el
     * service lo convierta a Map<Long, Long>.
     */
    @Query("""
            SELECT v.enfrentamiento.id, COUNT(v)
            FROM Voto v
            WHERE v.enfrentamiento.torneo.id = :torneoId
            GROUP BY v.enfrentamiento.id
            """)
    List<Object[]> contarVotosPorEnfrentamientoDeTorneo(@Param("torneoId") Long torneoId);

    /** Borra todos los votos cuyo personaje sea el id dado. */
    @Modifying
    @Query("DELETE FROM Voto v WHERE v.personaje.id = :personajeId")
    int deleteByPersonajeId(@Param("personajeId") Long personajeId);

    /**
     * Borra todos los votos cuyo enfrentamiento incluya al personaje dado
     * (como personaje1 o personaje2). Necesario antes de borrar los
     * enfrentamientos del personaje, porque Voto.enfrentamiento es FK.
     */
    @Modifying
    @Query("""
            DELETE FROM Voto v WHERE v.enfrentamiento.id IN (
              SELECT e.id FROM Enfrentamiento e
              WHERE e.personaje1.id = :personajeId OR e.personaje2.id = :personajeId
            )
            """)
    int deleteVotosEnEnfrentamientosDelPersonaje(@Param("personajeId") Long personajeId);
}
