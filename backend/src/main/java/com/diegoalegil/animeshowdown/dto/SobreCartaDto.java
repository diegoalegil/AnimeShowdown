package com.diegoalegil.animeshowdown.dto;

import com.diegoalegil.animeshowdown.model.CartaClimax;

public record SobreCartaDto(
        int posicion,
        CartaDto carta,
        boolean nueva,
        long recompensaDuplicado,
        CartaClimax climax) {
}
