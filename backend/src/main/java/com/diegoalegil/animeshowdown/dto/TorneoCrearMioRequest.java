package com.diegoalegil.animeshowdown.dto;

import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

/**
 * Request body para que un usuario verificado cree un torneo.
 *
 * <p>Diferencias respecto a {@link TorneoCrearRequest} (admin):
 * <ul>
 *   <li>Lleva la lista de {@code participantesIds} en el mismo body —
 *       admin podía crear el torneo vacío y poblarlo después con dos
 *       llamadas, pero el creador de a pie solo dispara una.</li>
 *   <li>El service valida que el tamaño sea exactamente 8 o 16 — el
 *       9 no permite tamaños arbitrarios para que el bracket
 *       siempre sea binario completo (sin BYEs).</li>
 * </ul>
 */
public class TorneoCrearMioRequest {

    @NotBlank(message = "El nombre es obligatorio")
    @Size(min = 5, max = 80, message = "El nombre debe tener entre 5 y 80 caracteres")
    private String nombre;

    @Size(max = 500, message = "La descripción no puede superar 500 caracteres")
    private String descripcion;

    @NotEmpty(message = "Debes elegir los personajes participantes")
    private List<Long> participantesIds;

    private Boolean publico = true;

    public TorneoCrearMioRequest() {
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }

    public List<Long> getParticipantesIds() {
        return participantesIds;
    }

    public void setParticipantesIds(List<Long> participantesIds) {
        this.participantesIds = participantesIds;
    }

    public Boolean getPublico() {
        return publico;
    }

    public void setPublico(Boolean publico) {
        this.publico = publico;
    }

    public boolean esPublico() {
        return publico == null || publico;
    }
}
