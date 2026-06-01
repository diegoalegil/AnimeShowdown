package com.diegoalegil.animeshowdown.dto;

import java.io.Serializable;

import com.diegoalegil.animeshowdown.model.RarezaCarta;

public record CartaCatalogoItem(
        Long id,
        Long personajeId,
        String personajeSlug,
        String personajeNombre,
        String anime,
        String imagenUrl,
        String colorDominante,
        RarezaCarta rareza,
        boolean especialCurada,
        String variante,
        String arteUrl) implements Serializable {
}
