package com.diegoalegil.animeshowdown.dto;

import com.diegoalegil.animeshowdown.model.DueloLiveChoice;

import jakarta.validation.constraints.NotNull;

public record DueloLiveVoteRequest(@NotNull DueloLiveChoice choice) {
}
