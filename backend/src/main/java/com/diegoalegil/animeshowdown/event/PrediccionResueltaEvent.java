package com.diegoalegil.animeshowdown.event;

/**
 * Evento publicado tras resolver predicciones al finalizar un torneo
 *.
 *
 * <p>Se emite UNA VEZ por usuario que tuvo al menos una predicción
 * resuelta. Lleva el total de aciertos y la racha consecutiva más reciente
 * para que listeners (badges) puedan disparar lógica sin re-consultar BBDD.
 */
public record PrediccionResueltaEvent(
        Long usuarioId,
        String username,
        long totalAciertos,
        int rachaConsecutivaActual) {
}
