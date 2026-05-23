package com.diegoalegil.animeshowdown.model;

/**
 * Ciclo de vida de un torneo.
 *
 * Antes los valores eran BORRADOR/ACTIVO/FINALIZADO. Se renombraron al
 * estándar SCHEDULED/IN_PROGRESS/FINISHED para
 * que el frontend pueda render progresivo del bracket por estado, y para
 * alinear con la convención usada en GitHub Actions, Kubernetes y schema.org
 * SportsEvent (que el Bloque 5.1 expondrá como JSON-LD).
 *
 * La migración de datos viejos la hace {@link com.diegoalegil.animeshowdown.config.EnumMigrations}
 * en arranque, idempotente.
 */
public enum EstadoTorneo {

    /** Creado pero la primera ronda no ha empezado. Antes "BORRADOR". */
    SCHEDULED,

    /** Al menos una ronda en juego. Antes "ACTIVO". */
    IN_PROGRESS,

    /** Bracket completo, ganador determinado. Antes "FINALIZADO". */
    FINISHED

}
