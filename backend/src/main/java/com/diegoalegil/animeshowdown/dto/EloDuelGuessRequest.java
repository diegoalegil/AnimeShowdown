package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record EloDuelGuessRequest(
        // Tope de longitud: el token de ronda se genera server-side (cifrado,
        // ~cientos de chars); 2048 es holgado para cualquier token legítimo y
        // corta payloads abusivos antes de procesarlos.
        @NotBlank @Size(max = 2048) String roundToken,
        @NotNull EloDuelChoice choice) {
}
