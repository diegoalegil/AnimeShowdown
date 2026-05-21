package com.diegoalegil.animeshowdown.dto;

public record DueloSugeridoDto(
        PersonajeMiniDto personaje1,
        PersonajeMiniDto personaje2,
        int elo1,
        int elo2,
        int eloDiff,
        String algoritmo) {
}
