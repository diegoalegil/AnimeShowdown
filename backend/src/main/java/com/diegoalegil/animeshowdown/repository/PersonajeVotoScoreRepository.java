package com.diegoalegil.animeshowdown.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.PersonajeVotoScore;

import jakarta.persistence.LockModeType;

public interface PersonajeVotoScoreRepository extends JpaRepository<PersonajeVotoScore, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from PersonajeVotoScore s where s.personajeId = :personajeId")
    Optional<PersonajeVotoScore> findByPersonajeIdForUpdate(@Param("personajeId") Long personajeId);

    @Query("""
            select s.personajeId, s.votosScore
            from PersonajeVotoScore s
            where s.votosScore > 0
            """)
    List<Object[]> findAllScores();

    @Modifying
    @Query(value = """
            INSERT INTO personaje_voto_score (personaje_id, votos_score, actualizado_en)
            SELECT p.id, 0, CURRENT_TIMESTAMP
            FROM personajes p
            WHERE NOT EXISTS (
                SELECT 1
                FROM personaje_voto_score s
                WHERE s.personaje_id = p.id
            )
            """, nativeQuery = true)
    int insertarFaltantesDesdePersonajes();
}
