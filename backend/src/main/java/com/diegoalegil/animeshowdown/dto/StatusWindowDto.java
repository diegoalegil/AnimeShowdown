package com.diegoalegil.animeshowdown.dto;

public record StatusWindowDto(
        String label,
        long checks,
        double uptimePercent,
        long avgLatencyMs,
        long p50LatencyMs,
        long downChecks) {
}
