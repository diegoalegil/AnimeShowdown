package com.diegoalegil.animeshowdown.model;

/**
 * Tipos de entidad sobre los que se puede reaccionar (Plan v2 §4.3).
 *
 * <ul>
 *   <li>{@link #PERSONAJE} — sobre un personaje del catálogo.</li>
 *   <li>{@link #TORNEO}    — sobre un torneo entero (lo épico que fue).</li>
 *   <li>{@link #MATCH}     — sobre un enfrentamiento concreto. Schema
 *       preparado pero la UI no lo expone todavía.</li>
 * </ul>
 */
public enum ReaccionTargetType {
    PERSONAJE,
    TORNEO,
    MATCH
}
