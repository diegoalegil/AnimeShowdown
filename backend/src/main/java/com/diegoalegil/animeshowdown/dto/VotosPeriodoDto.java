package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;

/**
 * Actividad reciente de votos de un personaje.
 *
 * <p>Devuelve los votos absolutos del periodo actual + el periodo
 * inmediatamente anterior de la misma duración. El frontend puede
 * pintar "+N votos esta semana" (votosPeriodoActual) y "subió/bajó
 * vs semana pasada" (delta = actual - anterior).
 *
 * <p>Fechas en UTC server-side. {@code fechaInicioActual} marca el
 * arranque de la ventana actual (now - dias); {@code fechaInicioAnterior}
 * el arranque de la ventana inmediatamente previa (now - 2·dias).
 */
public record VotosPeriodoDto(
        String slug,
        long votosPeriodoActual,
        long votosPeriodoAnterior,
        long delta,
        int dias,
        LocalDateTime fechaInicioActual,
        LocalDateTime fechaInicioAnterior) {

    public static VotosPeriodoDto vacio(String slug, int dias, LocalDateTime fechaInicioActual, LocalDateTime fechaInicioAnterior) {
        return new VotosPeriodoDto(slug, 0L, 0L, 0L, dias, fechaInicioActual, fechaInicioAnterior);
    }
}
