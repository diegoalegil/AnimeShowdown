package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDate;

/**
 * Punto de la serie "time machine del ELO" (Plan v2 §11.1).
 *
 * <p>{@code fecha} es el día observado. {@code votosAcumulados} es el
 * total de votos del personaje al cierre de ese día (count creciente
 * en el tiempo). El frontend lo renderiza como una línea SVG simple
 * en la ficha del personaje.
 */
public record EloHistoryPoint(LocalDate fecha, long votosAcumulados) {
}
