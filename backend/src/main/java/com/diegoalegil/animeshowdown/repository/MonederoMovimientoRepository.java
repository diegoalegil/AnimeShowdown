package com.diegoalegil.animeshowdown.repository;

import java.time.LocalDateTime;

import org.springframework.data.jpa.repository.JpaRepository;

import com.diegoalegil.animeshowdown.model.MonederoMovimiento;
import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.Usuario;

public interface MonederoMovimientoRepository extends JpaRepository<MonederoMovimiento, Long> {

    /** Pre-check de idempotencia antes de tocar el UNIQUE constraint. */
    boolean existsByUsuarioAndMotivoAndReferencia(
            Usuario usuario, MotivoMovimiento motivo, String referencia);

    /**
     * Cuántos drops (ganancias, delta &gt; 0) ha recibido el usuario desde
     * {@code desde} — soporta el tope diario de drops (anti-farmeo suave).
     */
    long countByUsuarioAndDeltaGreaterThanAndCreadoEnAfter(
            Usuario usuario, long delta, LocalDateTime desde);
}
