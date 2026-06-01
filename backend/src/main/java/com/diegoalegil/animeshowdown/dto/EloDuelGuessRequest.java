package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record EloDuelGuessRequest(
        @NotBlank String roundToken,
        @NotNull EloDuelChoice choice) {
}
