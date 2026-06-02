package com.diegoalegil.animeshowdown.event;

/**
 * Publicado por cada voto para materializar el score de personaje (tabla
 * personaje_voto_score, V53) FUERA de la transacción síncrona del POST /votar.
 * Lo consume {@code VotoScoreListener} en AFTER_COMMIT de forma asíncrona, igual
 * que los listeners de badges y drops, para que el POST no retenga el lock de la
 * fila del personaje a través de la petición.
 *
 * <p>Lleva los ids ya resueltos (no la entidad) para no depender de asociaciones
 * lazy tras el commit. En empate {@code votoPersonajeId} es indiferente: se
 * incrementan ambos participantes.
 */
public record VotoScoreEvent(
        boolean empate,
        Long votoPersonajeId,
        Long personaje1Id,
        Long personaje2Id) {
}
