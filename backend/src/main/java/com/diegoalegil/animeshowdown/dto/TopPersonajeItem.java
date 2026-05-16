package com.diegoalegil.animeshowdown.dto;

/**
 * Entrada del Top N de personajes votados por el usuario (Plan v2 §4.1).
 */
public record TopPersonajeItem(
        Long personajeId,
        String slug,
        String nombre,
        String imagenUrl,
        String anime,
        long votos) {
}
