package com.diegoalegil.animeshowdown.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.Prediccion;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;

public interface PrediccionRepository extends JpaRepository<Prediccion, Long> {

    Optional<Prediccion> findByUsuarioAndEnfrentamiento(Usuario usuario, Enfrentamiento enf);

    /** Todas las predicciones de un torneo (cualquier usuario). Usada por resolverParaTorneo. */
    @Query("""
            SELECT p FROM Prediccion p
            WHERE p.enfrentamiento.torneo = :torneo
            """)
    List<Prediccion> findByTorneo(@Param("torneo") Torneo torneo);

    /** Predicciones del usuario en un torneo concreto, ordenadas por id ASC (ronda implícita). */
    @Query("""
            SELECT p FROM Prediccion p
            WHERE p.usuario = :usuario AND p.enfrentamiento.torneo = :torneo
            ORDER BY p.enfrentamiento.ronda ASC, p.enfrentamiento.id ASC
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
}
