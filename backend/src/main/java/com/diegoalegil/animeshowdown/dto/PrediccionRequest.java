package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Body de POST /api/predicciones (Plan v2 §4.4).
 *
 * <p>El backend infiere el torneo a partir del enfrentamientoId — el cliente
 * solo envía el match y el personaje al que predice.
 */
public class PrediccionRequest {

    @NotNull(message = "enfrentamientoId es obligatorio")
    private Long enfrentamientoId;

    @NotNull(message = "personajePredichoId es obligatorio")
    private Long personajePredichoId;

    public PrediccionRequest() {}

    public Long getEnfrentamientoId() { return enfrentamientoId; }
    public void setEnfrentamientoId(Long id) { this.enfrentamientoId = id; }
    public Long getPersonajePredichoId() { return personajePredichoId; }
    public void setPersonajePredichoId(Long id) { this.personajePredichoId = id; }
}
