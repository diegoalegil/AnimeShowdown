package com.diegoalegil.animeshowdown.model;

/**
 * Visibilidad de un torneo (Plan v2 §4.9).
 *
 * <p>Por ahora solo {@link #PUBLICO} se expone en la API — los creados
 * por user nacen públicos. {@link #PRIVADO} está preparado para una
 * iteración futura donde el creador podrá generar torneos con link
 * compartible y bracket visible solo para invitados (Plan v2 §4.9.f).
 */
public enum VisibilidadTorneo {

    /** Listado en /torneos, indexable por SEO. Default. */
    PUBLICO,

    /** Solo accesible con el slug — no aparece en listados. Futuro. */
    PRIVADO
}
