package com.diegoalegil.animeshowdown.dto;

/**
 * Broadcast genérico para que los clientes refetcheen el bracket completo.
 */
public record TorneoBracketChangedEvent(
        Long torneoId,
        String slug,
        String estado,
        String reason) {
}
