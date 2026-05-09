package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.NotNull;

public class VotoEnfrentamientoRequest {

    @NotNull(message = "personajeGanadorId es obligatorio")
    private Long personajeGanadorId;

    public VotoEnfrentamientoRequest() {
    }

    public Long getPersonajeGanadorId() {
        return personajeGanadorId;
    }

    public void setPersonajeGanadorId(Long personajeGanadorId) {
        this.personajeGanadorId = personajeGanadorId;
    }
}
