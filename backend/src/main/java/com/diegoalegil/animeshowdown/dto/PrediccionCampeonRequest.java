package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.NotNull;

public record PrediccionCampeonRequest(
        @NotNull(message = "torneoId es obligatorio")
        Long torneoId,

        @NotNull(message = "personajePredichoId es obligatorio")
        Long personajePredichoId
) { }
