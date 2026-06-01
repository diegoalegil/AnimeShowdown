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
}
