package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Body de DELETE /api/perfil/me.
 *
 * <p>Pedimos password de nuevo aunque el usuario tenga sesión activa
 * — es una acción irreversible y queremos mitigación contra session
 * hijacking. La confirmación textual la valida el frontend antes de
 * llamar, no el backend.
 */
public record EliminarCuentaRequest(@NotBlank String password) {
}
