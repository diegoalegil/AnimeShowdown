package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDate;

/**
 * Vista server-side del progreso diario + racha de un usuario. Espeja la forma
 * que el frontend ya manejaba en localStorage (progress + streak) para que la
 * sincronización sea directa.
 */
public record DailyProgressDto(Progreso progreso, Racha racha) {

    public record Progreso(
            LocalDate fecha,
            int votos,
            int juegos,
            boolean rankingVisto,
            boolean completado) {
    }

    public record Racha(
            int actual,
            int record,
            LocalDate ultimaFechaCompletada) {
    }
}
