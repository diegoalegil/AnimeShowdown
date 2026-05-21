package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;

public record StatusSampleDto(
        LocalDateTime checkedAt,
        String status,
        long latencyMs) {
}
