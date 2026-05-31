package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.NotNull;

public class PrediccionCampeonRequest {

    @NotNull(message = "torneoId es obligatorio")
    private Long torneoId;

    @NotNull(message = "personajePredichoId es obligatorio")
    private Long personajePredichoId;

    public PrediccionCampeonRequest() {
    }

    public Long getTorneoId() {
        return torneoId;
    }

    public void setTorneoId(Long torneoId) {
        this.torneoId = torneoId;
    }

    public Long getPersonajePredichoId() {
        return personajePredichoId;
    }

    public void setPersonajePredichoId(Long personajePredichoId) {
        this.personajePredichoId = personajePredichoId;
    }
}
