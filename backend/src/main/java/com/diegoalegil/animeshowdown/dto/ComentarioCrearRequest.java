package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ComentarioCrearRequest(
        @NotBlank
        @Size(min = 2, max = 1000)
        String contenido) {
}
