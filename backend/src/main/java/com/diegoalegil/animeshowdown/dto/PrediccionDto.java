package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;

import com.diegoalegil.animeshowdown.model.Prediccion;

/**
 * Vista pública de una predicción para el cliente.
 *
 * <p>{@code acertada} null = pendiente, true/false = resuelta. El frontend
 * lo usa para pintar tres estados: gris pendiente / verde acierto / rojo
 * fallo.
 */
public record PrediccionDto(
        Long id,
        Long enfrentamientoId,
        Long torneoId,
        String tipo,
        Long personajePredichoId,
        String personajePredichoSlug,
        String personajePredichoNombre,
        LocalDateTime fecha,
        Boolean acertada,
        int puntos) {

    public static PrediccionDto from(Prediccion p) {
        var pred = p.getPersonajePredicho();
        boolean campeon = p.getTipo() == com.diegoalegil.animeshowdown.model.TipoPrediccion.CAMPEON;
        return new PrediccionDto(
                p.getId(),
                p.getEnfrentamiento() == null ? null : p.getEnfrentamiento().getId(),
                p.getTorneo() == null ? null : p.getTorneo().getId(),
                p.getTipo().name(),
                pred.getId(),
                pred.getSlug(),
                pred.getNombre(),
                p.getFecha(),
                p.getAcertada(),
                campeon && Boolean.TRUE.equals(p.getAcertada()) ? 10 : 0);
    }
}
