package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * V-8: cambio de username desde el onboarding post-login o desde Ajustes.
 *
 * <p>Mismas reglas que el registro (3-30, alfanumérico + {@code _ -}) para que
 * un username elegido aquí sea siempre válido para registro y URLs públicas
 * {@code /u/{username}}. La unicidad case-insensitive se valida en el
 * controller (409 si está tomado).
 */
public record CambioUsernameRequest(

        @NotBlank(message = "El username es obligatorio")
        @Size(min = 3, max = 30, message = "El username debe tener entre 3 y 30 caracteres")
        @Pattern(
                regexp = "^[A-Za-z0-9_-]+$",
                message = "El username solo puede contener letras, números, guión y guión bajo")
        String username) {
}
