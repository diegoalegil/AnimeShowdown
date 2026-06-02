package com.diegoalegil.animeshowdown.repository;

import java.time.LocalDateTime;
import java.util.Collection;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.MonederoMovimiento;
import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.Usuario;

public interface MonederoMovimientoRepository extends JpaRepository<MonederoMovimiento, Long> {

    /** Pre-check de idempotencia antes de tocar el UNIQUE constraint. */
    boolean existsByUsuarioAndMotivoAndReferencia(
            Usuario usuario, MotivoMovimiento motivo, String referencia);

    @Query("""
            SELECT COUNT(m)
            FROM MonederoMovimiento m
            WHERE m.usuario = :usuario
              AND m.delta > 0
              AND m.motivo IN :motivos
              AND m.creadoEn >= :desde
            """)
    long countDropsDesde(
            @Param("usuario") Usuario usuario,
            @Param("motivos") Collection<MotivoMovimiento> motivos,
            @Param("desde") LocalDateTime desde);
}
