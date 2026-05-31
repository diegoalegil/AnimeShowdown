package com.diegoalegil.animeshowdown.dto;

import java.util.List;

import com.diegoalegil.animeshowdown.model.RarezaCarta;

/**
 * Probabilidades TRANSPARENTES de un sobre (requisito anti-casino: nunca
 * opacas). Expone el precio, el tamaño del pool y la probabilidad por rareza.
 * En F1 sólo se reparte SSR ⇒ 100% SSR; las ESPECIAL no entran en sobres.
 */
public record OddsDto(
        long precioSobre,
        int cartasEnPool,
        int cartasPorSobre,
        int normalesPorSobre,
        double probabilidadEspecialBase,
        int pityDuro,
        List<RarezaOdds> rarezas) {

    public record RarezaOdds(RarezaCarta rareza, double probabilidad, String etiqueta) {
    }
}
