package com.diegoalegil.animeshowdown.dto;

import com.diegoalegil.animeshowdown.model.Enfrentamiento;

/**
 * Match del bracket en formato cliente. `personaje1` y `personaje2` pueden
 * ser null si pertenecen a una ronda futura sin resolver (Plan v2 §1.1).
 * `ganador` es null mientras el match no se haya cerrado.
 *
 * `totalVotos` es opcional — se rellena solo en endpoint de detalle, no
 * en listados, para no hacer N queries de count.
 */
public class EnfrentamientoDto {

    private Long id;
    private Integer ronda;
    private PersonajeMiniDto personaje1;
    private PersonajeMiniDto personaje2;
    private PersonajeMiniDto ganador;
    private Long totalVotos;

    public EnfrentamientoDto() {
    }

    public static EnfrentamientoDto from(Enfrentamiento e, Long totalVotos) {
        EnfrentamientoDto dto = new EnfrentamientoDto();
        dto.id = e.getId();
        dto.ronda = e.getRonda();
        dto.personaje1 = PersonajeMiniDto.from(e.getPersonaje1());
        dto.personaje2 = PersonajeMiniDto.from(e.getPersonaje2());
        dto.ganador = PersonajeMiniDto.from(e.getGanador());
        dto.totalVotos = totalVotos;
        return dto;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Integer getRonda() {
        return ronda;
    }

    public void setRonda(Integer ronda) {
        this.ronda = ronda;
    }

    public PersonajeMiniDto getPersonaje1() {
        return personaje1;
    }

    public void setPersonaje1(PersonajeMiniDto personaje1) {
        this.personaje1 = personaje1;
    }

    public PersonajeMiniDto getPersonaje2() {
        return personaje2;
    }

    public void setPersonaje2(PersonajeMiniDto personaje2) {
        this.personaje2 = personaje2;
    }

    public PersonajeMiniDto getGanador() {
        return ganador;
    }

    public void setGanador(PersonajeMiniDto ganador) {
        this.ganador = ganador;
    }

    public Long getTotalVotos() {
        return totalVotos;
    }

    public void setTotalVotos(Long totalVotos) {
        this.totalVotos = totalVotos;
    }
}
