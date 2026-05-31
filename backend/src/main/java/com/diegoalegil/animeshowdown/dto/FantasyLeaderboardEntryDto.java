package com.diegoalegil.animeshowdown.dto;

import java.util.List;

public record FantasyLeaderboardEntryDto(
        int posicion,
        String username,
        String avatarUrl,
        int puntos,
        int costeTotal,
        List<FantasyEquipoItemDto> items) {
}
