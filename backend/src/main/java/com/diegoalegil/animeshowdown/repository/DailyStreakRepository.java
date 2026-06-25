package com.diegoalegil.animeshowdown.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.DailyStreak;

import jakarta.persistence.LockModeType;

public interface DailyStreakRepository extends JpaRepository<DailyStreak, Long> {

    /**
     * Lectura CON lock pesimista: la racha se actualiza con read-modify-write
     * (mira la última fecha, incrementa o reinicia), así que el lock evita que
     * dos acciones que completan el mismo día compitan por la fila.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from DailyStreak s where s.usuarioId = :usuarioId")
    Optional<DailyStreak> lockByUsuario(@Param("usuarioId") Long usuarioId);
}
