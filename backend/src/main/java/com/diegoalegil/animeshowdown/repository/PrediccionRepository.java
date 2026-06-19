package com.diegoalegil.animeshowdown.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.Prediccion;
import com.diegoalegil.animeshowdown.model.TipoPrediccion;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;

import jakarta.persistence.LockModeType;

public interface PrediccionRepository extends JpaRepository<Prediccion, Long> {

    Optional<Prediccion> findByUsuarioAndEnfrentamiento(Usuario usuario, Enfrentamiento enf);

    Optional<Prediccion> findByUsuarioAndTorneoAndTipo(Usuario usuario, Torneo torneo, TipoPrediccion tipo);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Prediccion p WHERE p.usuario = :usuario AND p.enfrentamiento = :enfrentamiento")
    Optional<Prediccion> findByUsuarioAndEnfrentamientoForUpdate(
            @Param("usuario") Usuario usuario,
            @Param("enfrentamiento") Enfrentamiento enfrentamiento);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT p FROM Prediccion p
            WHERE p.usuario = :usuario
              AND p.torneo = :torneo
              AND p.tipo = :tipo
            """)
    Optional<Prediccion> findByUsuarioAndTorneoAndTipoForUpdate(
            @Param("usuario") Usuario usuario,
            @Param("torneo") Torneo torneo,
            @Param("tipo") TipoPrediccion tipo);

    /** Todas las predicciones de un torneo (cualquier usuario). Usada por resolverParaTorneo. */
    @Query("""
            SELECT p FROM Prediccion p
            LEFT JOIN p.enfrentamiento e
            WHERE e.torneo = :torneo OR p.torneo = :torneo
            """)
    List<Prediccion> findByTorneo(@Param("torneo") Torneo torneo);

    /** IDs distintos de los usuarios que predijeron en el torneo (cohorte premiable). */
    @Query("""
            SELECT DISTINCT p.usuario.id FROM Prediccion p
            LEFT JOIN p.enfrentamiento e
            WHERE e.torneo = :torneo OR p.torneo = :torneo
            """)
    List<Long> findDistinctUsuarioIdsByTorneo(@Param("torneo") Torneo torneo);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT p FROM Prediccion p
            LEFT JOIN p.enfrentamiento e
            WHERE p.acertada IS NULL
              AND (e.torneo = :torneo OR p.torneo = :torneo)
            """)
    List<Prediccion> findPendientesByTorneoForUpdate(@Param("torneo") Torneo torneo);

    /** Predicciones del usuario en un torneo concreto, ordenadas por id ASC (ronda implícita). */
    @Query("""
            SELECT p FROM Prediccion p
            LEFT JOIN p.enfrentamiento e
            LEFT JOIN FETCH p.personajePredicho
            WHERE p.usuario = :usuario AND (e.torneo = :torneo OR p.torneo = :torneo)
            ORDER BY p.tipo DESC, e.ronda ASC, e.id ASC
            """)
    List<Prediccion> findByUsuarioAndTorneo(@Param("usuario") Usuario usuario,
            @Param("torneo") Torneo torneo);

    /** Total de predicciones acertadas de un usuario (badge profeta = 20+). */
    long countByUsuarioAndAcertadaTrue(Usuario usuario);

    /**
     * Últimas predicciones resueltas del usuario, en orden cronológico
     * descendiente (más recientes primero). Para detectar streaks de
     * aciertos consecutivos. Limitamos a 20 — suficiente para los badges
     * de 3 y 10 seguidos.
     */
    @Query("""
            SELECT p FROM Prediccion p
            WHERE p.usuario = :usuario AND p.acertada IS NOT NULL
            ORDER BY p.fecha DESC
            """)
    List<Prediccion> findResueltasDelUsuarioDesc(@Param("usuario") Usuario usuario,
            org.springframework.data.domain.Pageable pageable);

    /**
     * Leaderboard del último mes: top N usuarios por número de predicciones
     * acertadas en un rango. Devuelve {usuarioId, username, totalAciertos}.
     */
    @Query("""
            SELECT p.usuario.id, p.usuario.username, COUNT(p)
            FROM Prediccion p
            WHERE p.acertada = true AND p.fecha >= :desde
            GROUP BY p.usuario.id, p.usuario.username
            ORDER BY COUNT(p) DESC
            """)
    List<Object[]> leaderboardDesde(@Param("desde") LocalDateTime desde,
            org.springframework.data.domain.Pageable pageable);

    @Query("""
            SELECT p.usuario.id, p.usuario.username, COUNT(p), COUNT(p) * 10
            FROM Prediccion p
            WHERE p.tipo = com.diegoalegil.animeshowdown.model.TipoPrediccion.CAMPEON
              AND p.torneo = :torneo
              AND p.acertada = true
            GROUP BY p.usuario.id, p.usuario.username
            ORDER BY COUNT(p) DESC, p.usuario.username ASC
            """)
    List<Object[]> leaderboardCampeonPorTorneo(@Param("torneo") Torneo torneo,
            org.springframework.data.domain.Pageable pageable);

    @Query("""
            SELECT COUNT(p) * 10
            FROM Prediccion p
            WHERE p.usuario = :usuario
              AND p.tipo = com.diegoalegil.animeshowdown.model.TipoPrediccion.CAMPEON
              AND p.acertada = true
            """)
    long puntosCampeonAcumulados(@Param("usuario") Usuario usuario);

    /**
     * borra todas las predicciones cuyo personaje
     * predicho es el dado. Usado por DataSeeder al retirar un personaje
     * del seed — sin esto, V9__predicciones.sql:30 tiene FK restrictiva
     * (fk_pred_personaje sin ON DELETE) y el arranque revienta con
     * constraint violation. Una predicción huérfana no tiene sentido
     * de negocio (apuntaba a un personaje que ya no existe), así que
     * borrar es coherente con el cascade existente de votos.
     */
    @Modifying
    @Query("DELETE FROM Prediccion p WHERE p.personajePredicho.id = :personajeId")
    int deleteByPersonajePredichoId(@Param("personajeId") Long personajeId);
}
