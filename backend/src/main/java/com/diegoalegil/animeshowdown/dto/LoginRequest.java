package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank(message = "El username es obligatorio")
        String username,

        @NotBlank(message = "La password es obligatoria")
        String password) {
}
