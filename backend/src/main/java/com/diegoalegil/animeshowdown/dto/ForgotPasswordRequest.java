package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record ForgotPasswordRequest(

        @NotBlank(message = "El email es obligatorio")
        @Email(message = "El email no tiene formato válido")
        String email) {
}
