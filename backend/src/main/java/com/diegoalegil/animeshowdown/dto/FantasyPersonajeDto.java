package com.diegoalegil.animeshowdown.dto;

import com.diegoalegil.animeshowdown.model.Personaje;

public record FantasyPersonajeDto(
        Long id,
        String slug,
        String nombre,
        String anime,
        String imagenUrl,
        int eloEstimado,
        int coste,
        Integer deltaSemanal) {

    public static FantasyPersonajeDto from(Personaje personaje, int eloEstimado,
            int coste, Integer deltaSemanal) {
        return new FantasyPersonajeDto(
                personaje.getId(),
                personaje.getSlug(),
                personaje.getNombre(),
                personaje.getAnime(),
                personaje.getImagenUrl(),
                eloEstimado,
                coste,
                deltaSemanal);
    }
}
