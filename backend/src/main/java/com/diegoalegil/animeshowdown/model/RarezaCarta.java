package com.diegoalegil.animeshowdown.model;

/**
 * Rareza de una carta coleccionable.
 *
 * <p>Fase 1 sólo reparte {@link #SSR} (todas las cartas normales). La rareza
 * {@link #ESPECIAL} queda soportada en el modelo —arte curado por el owner—
 * pero NO entra en el drop normal: es premio/evento que se revelará en Fase 2.
 */
public enum RarezaCarta {
    /** Carta normal. Toda carta del catálogo base es SSR y entra en los sobres. */
    SSR,
    /** Carta especial curada por el owner. Premio/evento; fuera del drop normal. */
    ESPECIAL
}
