package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * Semilla ÚNICA de la racha local (de localStorage) hacia el servidor, en el
 * primer login tras migrar a la racha server-side. El servidor es el guardián:
 * solo la acepta si aún no tiene racha, si la fecha es de hoy/ayer (viva) y
 * capando {@code actual} a los días desde el registro — así una racha local
 * inflada o muerta no contamina el server ni futuros leaderboards.
 */
public record MigrarRachaRequest(
        @NotNull @Min(1) @Max(100_000) Integer actual,
        @NotNull LocalDate ultimaFechaCompletada) {
}
