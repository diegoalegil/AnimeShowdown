package com.diegoalegil.animeshowdown.model;

/**
 * Estado de moderación de una sugerencia de personaje.
 *
 * <p>Transiciones permitidas (sin vuelta atrás):
 * <pre>
 *   PENDIENTE → APROBADO   (admin acepta la idea)
 *   PENDIENTE → RECHAZADO  (admin rechaza con motivo)
 * </pre>
 * APROBADO es solo la señal de intención: el alta real del personaje (arte,
 * slug, catálogo) la hace el owner manualmente. Los rechazados quedan
 * persistidos para que el proponente vea el motivo en su historial.
 */
public enum SugerenciaEstado {

    /** Recién enviada por un usuario, en cola admin esperando decisión. */
    PENDIENTE,

    /** Admin aceptó la idea — se estudiará para el catálogo. */
    APROBADO,

    /** Admin la rechazó con motivo. Visible solo para su proponente. */
    RECHAZADO
}
