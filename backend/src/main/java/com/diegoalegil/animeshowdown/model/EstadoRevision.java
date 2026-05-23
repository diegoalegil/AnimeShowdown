package com.diegoalegil.animeshowdown.model;

/**
 * Estado de revisión administrativa de un torneo.
 *
 * <p>Aplica solo a torneos creados por usuarios — los creados por admin
 * directamente (legacy o /api/torneos POST) llevan {@link #NO_APLICA} y
 * son visibles inmediatamente sin pasar por la cola.
 *
 * <p>Transiciones permitidas:
 * <pre>
 *   PENDIENTE → APROBADO   (admin acepta)
 *   PENDIENTE → RECHAZADO  (admin rechaza con motivo)
 * </pre>
 * No hay vuelta atrás — un torneo aprobado no se "des-aprueba". Para
 * retirar un torneo aprobado existirá un soft-delete futuro. Los rechazados quedan persistidos para que el creador vea
 * el motivo en "Mis torneos".
 */
public enum EstadoRevision {

    /** Torneo creado por admin directamente — no requiere moderación. */
    NO_APLICA,

    /** Recién enviado por un user, en cola admin esperando decisión. */
    PENDIENTE,

    /** Admin lo aceptó: ya es visible públicamente como cualquier torneo. */
    APROBADO,

    /** Admin lo rechazó. Visible solo para su creador en "Mis torneos". */
    RECHAZADO
}
