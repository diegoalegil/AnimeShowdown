package com.diegoalegil.animeshowdown.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.FantasyEquipoItem;

public interface FantasyEquipoItemRepository extends JpaRepository<FantasyEquipoItem, Long> {

    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM FantasyEquipoItem item WHERE item.personaje.id = :personajeId")
    int deleteByPersonajeId(@Param("personajeId") Long personajeId);

    /** ¿El personaje está fichado en algún equipo fantasy? Guard del borrado de
     *  personaje: la FK es ON DELETE CASCADE (V52), así que sin esto el borrado
     *  encogería los equipos en silencio y corrompería la puntuación de la semana. */
    boolean existsByPersonajeId(Long personajeId);
}
