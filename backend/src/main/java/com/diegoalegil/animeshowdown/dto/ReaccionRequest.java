package com.diegoalegil.animeshowdown.dto;

import com.diegoalegil.animeshowdown.model.ReaccionTargetType;
import com.diegoalegil.animeshowdown.model.ReaccionTipo;

import jakarta.validation.constraints.NotNull;

/**
 * Body de POST /api/reacciones (Plan v2 §4.3).
 *
 * Spring deserializa los enums {@code targetType} y {@code tipo} con
 * case-sensitive match al name() del enum. Si llega un valor inválido
 * salta el GlobalExceptionHandler con 400.
 */
public class ReaccionRequest {

    @NotNull(message = "targetType es obligatorio")
    private ReaccionTargetType targetType;

    @NotNull(message = "targetId es obligatorio")
    private Long targetId;

    @NotNull(message = "tipo es obligatorio")
    private ReaccionTipo tipo;

    public ReaccionRequest() {}

    public ReaccionTargetType getTargetType() { return targetType; }
    public void setTargetType(ReaccionTargetType targetType) { this.targetType = targetType; }
    public Long getTargetId() { return targetId; }
    public void setTargetId(Long targetId) { this.targetId = targetId; }
    public ReaccionTipo getTipo() { return tipo; }
    public void setTipo(ReaccionTipo tipo) { this.tipo = tipo; }
}
