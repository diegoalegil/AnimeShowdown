package com.diegoalegil.animeshowdown.dto;

public record CartaTradeCreateRequest(
        String destinatarioUsername,
        Long cartaOfrecidaId,
        Long cartaSolicitadaId,
        String idempotencyKey) {
}
