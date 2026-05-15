package com.diegoalegil.animeshowdown.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
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
}
