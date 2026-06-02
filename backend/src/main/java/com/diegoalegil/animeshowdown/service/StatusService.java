package com.diegoalegil.animeshowdown.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import com.diegoalegil.animeshowdown.dto.StatusResponseDto;
import com.diegoalegil.animeshowdown.dto.StatusSampleDto;
import com.diegoalegil.animeshowdown.dto.StatusWindowDto;
import com.diegoalegil.animeshowdown.model.UptimeLog;
import com.diegoalegil.animeshowdown.repository.UptimeLogRepository;

@Service
public class StatusService {

    public static final Duration PUBLIC_CACHE_TTL = Duration.ofSeconds(30);

    private final UptimeLogRepository uptimeLogRepository;
    private final Clock clock;
    private volatile CachedStatus cachedStatus;

    @Autowired
    public StatusService(UptimeLogRepository uptimeLogRepository) {
        this(uptimeLogRepository, Clock.systemUTC());
    }

    StatusService(UptimeLogRepository uptimeLogRepository, Clock clock) {
        this.uptimeLogRepository = uptimeLogRepository;
        this.clock = clock;
    }

    public StatusResponseDto resumenPublico() {
        Instant nowInstant = clock.instant();
        CachedStatus current = cachedStatus;
        if (current != null && nowInstant.isBefore(current.expiresAt())) {
            return current.response();
        }

        synchronized (this) {
            current = cachedStatus;
            if (current != null && nowInstant.isBefore(current.expiresAt())) {
                return current.response();
            }

            StatusResponseDto response = buildResponse(nowInstant);
            cachedStatus = new CachedStatus(response, nowInstant.plus(PUBLIC_CACHE_TTL));
            return response;
        }
    }

    private StatusResponseDto buildResponse(Instant nowInstant) {
        LocalDateTime now = LocalDateTime.ofInstant(nowInstant, ZoneOffset.UTC);
        UptimeLog latest = uptimeLogRepository.findTopByOrderByCheckedAtDesc();

        return new StatusResponseDto(
                latest == null ? "UNKNOWN" : latest.getStatus(),
                latest == null ? null : latest.getCheckedAt(),
                ventana("24h", now.minusHours(24)),
                ventana("7d", now.minusDays(7)),
                ventana("30d", now.minusDays(30)),
                ventana("90d", now.minusDays(90)),
                samples());
    }

    private StatusWindowDto ventana(String label, LocalDateTime desde) {
        UptimeLogRepository.UptimeWindowSummary summary = uptimeLogRepository.summarizeSince(desde);
        long checks = summary == null ? 0 : numberOrZero(summary.getChecks());

        if (checks == 0) {
            return new StatusWindowDto(label, 0, 0.0, 0, 0, 0);
        }

        long up = numberOrZero(summary.getUpChecks());
        long down = checks - up;
        long avg = Math.round(summary.getAvgLatencyMs() == null ? 0.0 : summary.getAvgLatencyMs());
        long p50 = p50Latency(desde, checks);

        return new StatusWindowDto(
                label,
                checks,
                round2((up * 100.0) / checks),
                avg,
                p50,
                down);
    }

    private List<StatusSampleDto> samples() {
        List<UptimeLog> latestSamples = new ArrayList<>(uptimeLogRepository.findTop180ByOrderByCheckedAtDesc());
        latestSamples.sort(Comparator.comparing(UptimeLog::getCheckedAt));
        return latestSamples.stream()
                .map(log -> new StatusSampleDto(log.getCheckedAt(), log.getStatus(), log.getLatencyMs()))
                .toList();
    }

    private long p50Latency(LocalDateTime desde, long checks) {
        int index = (int) Math.ceil(0.50 * checks) - 1;
        List<Long> values = uptimeLogRepository.findLatenciesSince(desde, PageRequest.of(Math.max(0, index), 1));
        if (values.isEmpty()) {
            return 0;
        }
        return values.get(0);
    }

    private static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private static long numberOrZero(Number value) {
        return value == null ? 0 : value.longValue();
    }

    private record CachedStatus(StatusResponseDto response, Instant expiresAt) {
    }
}
