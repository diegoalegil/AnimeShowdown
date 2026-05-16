package com.diegoalegil.animeshowdown.event;

import com.diegoalegil.animeshowdown.model.Usuario;

/**
 * Evento publicado tras resolver predicciones al finalizar un torneo
 * (Plan v2 §4.4).
 *
 * <p>Se emite UNA VEZ por usuario que tuvo al menos una predicción
 * resuelta. Lleva el total de aciertos y la racha consecutiva más reciente
 * para que listeners (badges) puedan disparar lógica sin re-consultar BBDD.
 */
public record PrediccionResueltaEvent(
        Usuario usuario,
        long totalAciertos,
        int rachaConsecutivaActual) {
}
