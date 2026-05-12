package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Cambio de contraseña del usuario autenticado. Se diferencia del reset
 * (forgot-password con código por email) en que aquí pides current_password
 * en lugar de código de email — es el flujo "estoy logueado y quiero cambiar".
 */
public class CambioPasswordRequest {

    @NotBlank(message = "Introduce tu contraseña actual")
    private String currentPassword;

    @NotBlank(message = "Introduce la contraseña nueva")
    @Size(min = 6, max = 100, message = "La contraseña nueva debe tener entre 6 y 100 caracteres")
    private String newPassword;

    public CambioPasswordRequest() {
    }

    public String getCurrentPassword() {
        return currentPassword;
    }

    public void setCurrentPassword(String currentPassword) {
        this.currentPassword = currentPassword;
    }

    public String getNewPassword() {
        return newPassword;
    }

    public void setNewPassword(String newPassword) {
        this.newPassword = newPassword;
    }
}
