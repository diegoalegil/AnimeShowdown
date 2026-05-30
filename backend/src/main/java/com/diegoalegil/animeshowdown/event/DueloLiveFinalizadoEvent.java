package com.diegoalegil.animeshowdown.event;

/**
 * Evento publicado al finalizar un duelo live PvP (los "daily games" de F1).
 *
 * <p>Lo dispara {@code DueloLiveService} en el único choke-point de cierre
 * ({@code aplicarEloYFinalizar}), cubra victoria por score o walkover. Listener
 * interesado: {@code CartaDropListener} dropea moneda al ganador.
 *
 * <p>{@code ganadorId} puede ser {@code null} cuando gana el bot (no hay
 * usuario humano al que recompensar) o en empate.
 */
public record DueloLiveFinalizadoEvent(Long dueloId, Long ganadorId) {
}
