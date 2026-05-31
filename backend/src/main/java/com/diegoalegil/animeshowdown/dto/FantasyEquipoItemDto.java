package com.diegoalegil.animeshowdown.dto;

import com.diegoalegil.animeshowdown.model.FantasyEquipoItem;

public record FantasyEquipoItemDto(
        Long personajeId,
        String slug,
        String nombre,
        String anime,
        String imagenUrl,
        int coste,
        Integer deltaSemanal) {

    public static FantasyEquipoItemDto from(FantasyEquipoItem item, Integer deltaSemanal) {
        var personaje = item.getPersonaje();
        return new FantasyEquipoItemDto(
                personaje.getId(),
                personaje.getSlug(),
                personaje.getNombre(),
                personaje.getAnime(),
                personaje.getImagenUrl(),
                item.getCoste(),
                deltaSemanal);
    }
}
