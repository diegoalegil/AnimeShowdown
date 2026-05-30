package com.diegoalegil.animeshowdown.dto;

/**
 * Resultado de abrir un sobre: la carta revelada, si es nueva en la colección,
 * el saldo restante y el precio pagado. El servidor es la única autoridad.
 */
public record AbrirSobreResultadoDto(
        CartaDto carta,
        boolean nueva,
        long saldoRestante,
        long precio) {
}
