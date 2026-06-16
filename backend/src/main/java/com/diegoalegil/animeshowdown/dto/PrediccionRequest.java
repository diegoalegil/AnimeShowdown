package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Body de POST /api/predicciones.
 *
 * <p>El backend infiere el torneo a partir del enfrentamientoId — el cliente
 * solo envía el match y el personaje al que predice.
 */
public record PrediccionRequest(
        @NotNull(message = "enfrentamientoId es obligatorio")
        Long enfrentamientoId,

        @NotNull(message = "personajePredichoId es obligatorio")
        Long personajePredichoId
) { }
