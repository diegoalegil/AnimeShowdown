package com.diegoalegil.animeshowdown.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.PersonajeVotoScore;

public interface PersonajeVotoScoreRepository extends JpaRepository<PersonajeVotoScore, Long> {

    /**
     * Incremento atómico del score: una sola sentencia {@code SET votos_score =
     * votos_score + :delta}, sin read-modify-write ni {@code FOR UPDATE} retenido
     * a través de la petición. Converge sin lost-update bajo concurrencia.
     * Devuelve filas afectadas (0 si la fila aún no existe).
     */
    @Modifying
    @Query("""
            update PersonajeVotoScore s
            set s.votosScore = s.votosScore + :delta,
                s.actualizadoEn = CURRENT_TIMESTAMP
            where s.personajeId = :personajeId
            """)
    int incrementarScore(@Param("personajeId") Long personajeId, @Param("delta") double delta);

    /**
     * Crea la fila de score si aún no existe, de forma idempotente y sin
     * excepción de PK duplicada (no envenena la transacción). Mismo patrón
     * dual H2/Postgres que {@code TorneoOperacionLockService}.
     */
    @Modifying
    @Query(value = """
            INSERT INTO personaje_voto_score (personaje_id, votos_score, actualizado_en)
            VALUES (:personajeId, 0, CURRENT_TIMESTAMP)
            ON CONFLICT DO NOTHING
            """, nativeQuery = true)
    int insertarSiFalta(@Param("personajeId") Long personajeId);

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
