package com.diegoalegil.animeshowdown.repository;

import java.time.LocalDate;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.DailyProgress;

import jakarta.persistence.LockModeType;

public interface DailyProgressRepository extends JpaRepository<DailyProgress, Long> {

    /** Lectura sin lock (vista de progreso). */
    Optional<DailyProgress> findByUsuarioIdAndFecha(Long usuarioId, LocalDate fecha);

    /**
     * Lectura CON lock pesimista de escritura: serializa votos concurrentes del
     * mismo usuario/día para que la acumulación no sufra lost-update (mismo
     * criterio que la economía de monedas).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from DailyProgress p where p.usuarioId = :usuarioId and p.fecha = :fecha")
    Optional<DailyProgress> lockByUsuarioYFecha(@Param("usuarioId") Long usuarioId, @Param("fecha") LocalDate fecha);
}
