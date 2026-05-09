package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.NotNull;

public class EnfrentamientoCrearRequest {

    @NotNull(message = "personaje1Id es obligatorio")
    private Long personaje1Id;

    @NotNull(message = "personaje2Id es obligatorio")
    private Long personaje2Id;

    public EnfrentamientoCrearRequest() {
    }

    public Long getPersonaje1Id() {
        return personaje1Id;
    }

    public void setPersonaje1Id(Long personaje1Id) {
        this.personaje1Id = personaje1Id;
    }

    public Long getPersonaje2Id() {
        return personaje2Id;
    }

    public void setPersonaje2Id(Long personaje2Id) {
        this.personaje2Id = personaje2Id;
    }
}
