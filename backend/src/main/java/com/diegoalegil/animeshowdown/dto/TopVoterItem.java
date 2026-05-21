package com.diegoalegil.animeshowdown.dto;

/**
 * Entrada pública del leaderboard de usuarios por votos emitidos.
 */
public record TopVoterItem(
        String username,
        String avatarUrl,
        Long votos) {
}
