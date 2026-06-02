package com.diegoalegil.animeshowdown.event;

/**
 * Señal mínima para cerrar brackets después de que un voto se haya confirmado.
 */
public record EnfrentamientoVotadoEvent(Long torneoId, Long enfrentamientoId) {
}
