package com.diegoalegil.animeshowdown.dto;

/**
 * Entrada del Top N de personajes votados por el usuario.
 */
public record TopPersonajeItem(
        Long personajeId,
        String slug,
        String nombre,
        String imagenUrl,
        String anime,
        double votos) {
}
