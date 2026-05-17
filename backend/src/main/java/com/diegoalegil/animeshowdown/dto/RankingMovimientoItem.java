package com.diegoalegil.animeshowdown.dto;

/**
 * Fila de "ranking con movimientos" (Plan v2 §4.x — indicadores ↑↓).
 *
 * <p>{@code posicionActual} = puesto en el ranking de hoy (1-based).
 * {@code posicionAnterior} = puesto en el ranking con el corte de hace
 * N días — null si el personaje no tenía votos en ese momento ("Nuevo").
 * {@code delta} = posicionAnterior - posicionActual, positivo si subió,
 * negativo si bajó, 0 si se mantiene. null si era nuevo.
 */
public record RankingMovimientoItem(
        Long personajeId,
        String slug,
        String nombre,
        String anime,
        String imagenUrl,
        long votos,
        int posicionActual,
        Integer posicionAnterior,
        Integer delta,
        boolean esNuevo) {
}
