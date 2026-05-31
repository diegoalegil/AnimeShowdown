package com.diegoalegil.animeshowdown.dto;

public record FantasyResumenDto(
        String semanaIso,
        int presupuesto,
        int slots,
        FantasyEquipoDto equipo) {
}
