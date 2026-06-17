package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(

        @NotBlank(message = "El email es obligatorio")
        @Email(message = "El email no tiene formato válido")
        String email,

        @NotBlank(message = "El código es obligatorio")
        @Pattern(regexp = "\\d{6}", message = "El código tiene que ser 6 dígitos")
        String codigo,

        // Mismo nivel de exigencia que en registro.
        @NotBlank(message = "La nueva contraseña es obligatoria")
        @Size(min = 8, max = 100, message = "La contraseña debe tener entre 8 y 100 caracteres")
        @Pattern(
                regexp = "^(?=.*[A-Za-z])(?=.*\\d).{8,100}$",
                message = "La contraseña debe incluir al menos una letra y un número")
        String newPassword) {
}
