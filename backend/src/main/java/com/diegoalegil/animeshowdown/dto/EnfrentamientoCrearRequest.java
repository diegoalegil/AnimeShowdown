package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.NotNull;

public record EnfrentamientoCrearRequest(

        @NotNull(message = "personaje1Id es obligatorio")
        Long personaje1Id,

        @NotNull(message = "personaje2Id es obligatorio")
        Long personaje2Id) {
}
