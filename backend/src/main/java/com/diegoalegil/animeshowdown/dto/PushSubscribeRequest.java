package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record PushSubscribeRequest(
        @NotBlank String endpoint,
        @Valid @NotNull Keys keys) {

    public record Keys(
            @NotBlank String p256dh,
            @NotBlank String auth) {
    }
}
