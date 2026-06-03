package com.diegoalegil.animeshowdown.event;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Publicado por cada voto para materializar las agregaciones diaria
 * ({@code voto_personaje_dia_stats}) y por-torneo ({@code voto_torneo_stats})
 * FUERA de la transacción síncrona del POST /votar. Lo consume
 * {@code VotoAgregadoStatsListener} en AFTER_COMMIT @Async.
 *
 * <p>Estas tablas solo las leen rankings por ventana (cacheados), nunca el DTO
 * del voto ni el delta WS, así que aceptan consistencia eventual de unos ms.
 * Lleva primitivos (ids + importes), no entidades, para no depender de
 * asociaciones lazy tras el commit.
 */
public record VotoAgregadoEvent(List<DiaDelta> deltas, LocalDate dia, Long torneoId) {

    public record DiaDelta(Long personajeId, BigDecimal votosScore, BigDecimal pesoVotos) {}
}
