package com.diegoalegil.animeshowdown.dto;

import java.time.Instant;

public record EloDuelRoundDto(
        String roundToken,
        PersonajeMiniDto reference,
        PersonajeMiniDto challenger,
        int referenceElo,
        String scoreLabel,
        String algoritmo,
        Instant expiresAt) {
}
