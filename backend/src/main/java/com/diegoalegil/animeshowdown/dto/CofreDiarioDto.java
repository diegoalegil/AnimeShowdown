package com.diegoalegil.animeshowdown.dto;

public record CofreDiarioDto(
        boolean aplicado,
        long cantidad,
        long saldo,
        String fecha) {
}
