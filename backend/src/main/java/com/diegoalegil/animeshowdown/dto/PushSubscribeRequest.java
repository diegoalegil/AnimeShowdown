package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record PushSubscribeRequest(
        @NotBlank @Size(max = 2048) String endpoint,
        @Valid @NotNull Keys keys) {

    public record Keys(
            @NotBlank @Size(min = 16, max = 512) @Pattern(regexp = "^[A-Za-z0-9_\\-=]+$") String p256dh,
            @NotBlank @Size(min = 8, max = 128) @Pattern(regexp = "^[A-Za-z0-9_\\-=]+$") String auth) {
    }
}
