package com.diegoalegil.animeshowdown.dto;

import com.diegoalegil.animeshowdown.model.SobreGratisCredito;

/**
 * Crédito de sobre gratis pendiente de abrir. El frontend pinta el botón
 * "abre tu sobre del evento" con esta etiqueta.
 */
public record SobreGratisDto(Long id, String origen, String etiqueta) {

    public static SobreGratisDto from(SobreGratisCredito credito) {
        return new SobreGratisDto(credito.getId(), credito.getOrigen(), credito.getEtiqueta());
    }
}
