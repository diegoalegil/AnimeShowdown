package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;
import java.util.List;

public record FantasyEquipoDto(
        Long id,
        String semanaIso,
        boolean locked,
        LocalDateTime lockedAt,
        int presupuesto,
        int costeTotal,
        int presupuestoRestante,
        int puntos,
        LocalDateTime puntosCalculadosAt,
        List<FantasyEquipoItemDto> items) {
}
