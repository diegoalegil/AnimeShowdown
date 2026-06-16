package com.diegoalegil.animeshowdown.dto;

import com.diegoalegil.animeshowdown.model.ReaccionTargetType;
import com.diegoalegil.animeshowdown.model.ReaccionTipo;

import jakarta.validation.constraints.NotNull;

/**
 * Body de POST /api/reacciones.
 *
 * Spring deserializa los enums {@code targetType} y {@code tipo} con
 * case-sensitive match al name() del enum. Si llega un valor inválido
 * salta el GlobalExceptionHandler con 400.
 */
public record ReaccionRequest(
        @NotNull(message = "targetType es obligatorio")
        ReaccionTargetType targetType,

        @NotNull(message = "targetId es obligatorio")
        Long targetId,

        @NotNull(message = "tipo es obligatorio")
        ReaccionTipo tipo) {
}
