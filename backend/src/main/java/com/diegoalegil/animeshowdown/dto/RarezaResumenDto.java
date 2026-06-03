package com.diegoalegil.animeshowdown.dto;

import com.diegoalegil.animeshowdown.model.RarezaCarta;

/** Conteo de cartas poseídas vs totales para una rareza. Alimenta los chips de
 *  progreso por rareza de la colección sin necesidad de enviar el array completo. */
public record RarezaResumenDto(
        RarezaCarta rareza,
        int total,
        int poseidas) {
}
