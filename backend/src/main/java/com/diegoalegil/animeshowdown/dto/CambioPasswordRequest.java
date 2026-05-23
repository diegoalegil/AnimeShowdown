package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Cambio de contraseña del usuario autenticado. Se diferencia del reset
 * (forgot-password con código por email) en que aquí pides current_password
 * en lugar de código de email — es el flujo "estoy logueado y quiero cambiar".
 */
public class CambioPasswordRequest {

    @NotBlank(message = "Introduce tu contraseña actual")
    private String currentPassword;

    // 5: misma regla que en registro/reset.
    @NotBlank(message = "Introduce la contraseña nueva")
    @Size(min = 8, max = 100, message = "La contraseña nueva debe tener entre 8 y 100 caracteres")
    @Pattern(
            regexp = "^(?=.*[A-Za-z])(?=.*\\d).{8,100}$",
            message = "La contraseña debe incluir al menos una letra y un número")
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
