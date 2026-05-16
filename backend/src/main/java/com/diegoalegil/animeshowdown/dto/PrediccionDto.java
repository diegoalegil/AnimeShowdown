package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;

import com.diegoalegil.animeshowdown.model.Prediccion;

/**
 * Vista pública de una predicción para el cliente (Plan v2 §4.4).
 *
 * <p>{@code acertada} null = pendiente, true/false = resuelta. El frontend
 * lo usa para pintar tres estados: gris pendiente / verde acierto / rojo
 * fallo.
 */
public record PrediccionDto(
        Long id,
        Long enfrentamientoId,
        Long personajePredichoId,
        String personajePredichoSlug,
        String personajePredichoNombre,
        LocalDateTime fecha,
        Boolean acertada) {

    public static PrediccionDto from(Prediccion p) {
        var pred = p.getPersonajePredicho();
        return new PrediccionDto(
                p.getId(),
                p.getEnfrentamiento().getId(),
                pred.getId(),
                pred.getSlug(),
                pred.getNombre(),
                p.getFecha(),
                p.getAcertada());
    }
}
