package com.diegoalegil.animeshowdown.dto;

public record EloDuelGuessResponse(
        boolean correct,
        EloDuelChoice choice,
        EloDuelChoice correctChoice,
        int referenceElo,
        int challengerElo,
        int eloDiff,
        EloDuelRoundDto nextRound) {
}
