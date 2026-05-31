package com.diegoalegil.animeshowdown.dto;

import java.util.List;

/**
 * Resultado de abrir un sobre. El servidor decide las 5 cartas y el cliente
 * sólo las revela; los campos {@code carta}/{@code nueva} conservan compat con
 * la Fase 1 apuntando a la primera carta del pack.
 */
public record AbrirSobreResultadoDto(
        CartaDto carta,
        List<SobreCartaDto> cartas,
        boolean nueva,
        boolean especial,
        int pityAntes,
        int pityDespues,
        long monedasDuplicados,
        long saldoRestante,
        long precio) {
}
