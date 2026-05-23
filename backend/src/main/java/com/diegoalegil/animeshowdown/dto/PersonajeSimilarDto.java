package com.diegoalegil.animeshowdown.dto;

/**
 * Personaje recomendado por similitud.
 *
 * <p>Incluye {@code votos} y {@code score} para que el frontend pueda
 * mostrarlos como label si quiere ("similitud 78%", "120 votos"). El
 * score está en [0, 1].
 */
public record PersonajeSimilarDto(
        Long id,
        String slug,
        String nombre,
        String anime,
        String imagenUrl,
        long votos,
        double score) {
}
