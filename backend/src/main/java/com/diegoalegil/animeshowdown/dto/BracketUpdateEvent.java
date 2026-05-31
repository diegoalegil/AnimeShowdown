package com.diegoalegil.animeshowdown.dto;

/**
 * Evento broadcast cuando alguien vota en un enfrentamiento.
 *
 * <p>Se emite al topic <code>/topic/torneo.{torneoId}.bracket</code>. Los
 * clientes suscritos al ver el bracket de ese torneo actualizan el conteo
 * de votos del match sin necesidad de polling.
 *
 * <p>Se mandan los dos conteos en lugar de "delta" para que el cliente
 * pueda recuperarse si pierde frames (reconexión, latencia): el último
 * evento siempre lleva el estado completo y actualizado.
 */
public record BracketUpdateEvent(
        Long torneoId,
        Long enfrentamientoId,
        Long personaje1Id,
        double personaje1Votos,
        Long personaje2Id,
        double personaje2Votos,
        double totalVotos) {
}
