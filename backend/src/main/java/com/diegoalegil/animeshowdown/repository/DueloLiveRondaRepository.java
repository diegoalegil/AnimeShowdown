package com.diegoalegil.animeshowdown.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.DueloLive;
import com.diegoalegil.animeshowdown.model.DueloLiveRonda;
import com.diegoalegil.animeshowdown.model.DueloLiveRondaEstado;

import jakarta.persistence.LockModeType;

public interface DueloLiveRondaRepository extends JpaRepository<DueloLiveRonda, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT r FROM DueloLiveRonda r
            JOIN FETCH r.duelo d
            JOIN FETCH r.personajeA
            JOIN FETCH r.personajeB
            WHERE d.id = :dueloId
              AND r.estado = com.diegoalegil.animeshowdown.model.DueloLiveRondaEstado.IN_PROGRESS
            ORDER BY r.numero DESC
            """)
    List<DueloLiveRonda> findRondaActivaForUpdate(@Param("dueloId") Long dueloId);

    @Query("""
            SELECT r FROM DueloLiveRonda r
            JOIN FETCH r.personajeA
            JOIN FETCH r.personajeB
            WHERE r.duelo.id = :dueloId
            ORDER BY r.numero DESC
            """)
    List<DueloLiveRonda> findByDueloIdDetalleDesc(@Param("dueloId") Long dueloId);

    Optional<DueloLiveRonda> findTopByDueloAndEstadoOrderByNumeroDesc(
            DueloLive duelo,
            DueloLiveRondaEstado estado);

    @Query("""
            SELECT r FROM DueloLiveRonda r
            JOIN FETCH r.duelo d
            JOIN FETCH d.jugador1
            LEFT JOIN FETCH d.jugador2
            WHERE r.estado = com.diegoalegil.animeshowdown.model.DueloLiveRondaEstado.IN_PROGRESS
              AND r.cierraEn < :limite
            """)
    List<DueloLiveRonda> findExpiradas(@Param("limite") LocalDateTime limite);

    /**
     * Borra las rondas donde el personaje participa (como personajeA o personajeB).
     * Lo usa DataSeeder.borrarPersonajeConCascada para limpiar la FK RESTRICT
     * antes de borrar un personaje que se retira del seed.
     */
    @Modifying
    @Query("DELETE FROM DueloLiveRonda r WHERE r.personajeA.id = :personajeId OR r.personajeB.id = :personajeId")
    int deleteByPersonajeId(@Param("personajeId") Long personajeId);
}
