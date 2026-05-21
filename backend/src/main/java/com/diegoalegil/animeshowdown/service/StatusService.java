package com.diegoalegil.animeshowdown.service;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Service;

import com.diegoalegil.animeshowdown.dto.StatusResponseDto;
import com.diegoalegil.animeshowdown.dto.StatusSampleDto;
import com.diegoalegil.animeshowdown.dto.StatusWindowDto;
import com.diegoalegil.animeshowdown.model.UptimeLog;
import com.diegoalegil.animeshowdown.repository.UptimeLogRepository;

@Service
public class StatusService {

    private static final String STATUS_UP = "UP";

    private final UptimeLogRepository uptimeLogRepository;

    public StatusService(UptimeLogRepository uptimeLogRepository) {
        this.uptimeLogRepository = uptimeLogRepository;
    }

    public StatusResponseDto resumenPublico() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        List<UptimeLog> logs = uptimeLogRepository.findByCheckedAtAfterOrderByCheckedAtAsc(now.minusDays(90));
        UptimeLog latest = logs.isEmpty() ? null : logs.get(logs.size() - 1);

        return new StatusResponseDto(
                latest == null ? "UNKNOWN" : latest.getStatus(),
                latest == null ? null : latest.getCheckedAt(),
                ventana("24h", logs, now.minusHours(24)),
                ventana("7d", logs, now.minusDays(7)),
                ventana("30d", logs, now.minusDays(30)),
                ventana("90d", logs, now.minusDays(90)),
                samples(logs));
    }

    private static StatusWindowDto ventana(String label, List<UptimeLog> logs, LocalDateTime desde) {
        List<UptimeLog> window = logs.stream()
                .filter(log -> !log.getCheckedAt().isBefore(desde))
                .toList();

        if (window.isEmpty()) {
            return new StatusWindowDto(label, 0, 0.0, 0, 0, 0);
        }

        long up = window.stream().filter(StatusService::isUp).count();
        long down = window.size() - up;
        long avg = Math.round(window.stream()
                .mapToLong(UptimeLog::getLatencyMs)
                .average()
                .orElse(0));
        long p50 = percentile(window.stream()
                .map(UptimeLog::getLatencyMs)
                .sorted()
                .toList(), 0.50);

        return new StatusWindowDto(
                label,
                window.size(),
                round2((up * 100.0) / window.size()),
                avg,
                p50,
                down);
    }

    private static List<StatusSampleDto> samples(List<UptimeLog> logs) {
        int from = Math.max(0, logs.size() - 180);
        return logs.subList(from, logs.size()).stream()
                .sorted(Comparator.comparing(UptimeLog::getCheckedAt))
                .map(log -> new StatusSampleDto(log.getCheckedAt(), log.getStatus(), log.getLatencyMs()))
                .toList();
    }

    private static boolean isUp(UptimeLog log) {
        return STATUS_UP.equalsIgnoreCase(log.getStatus());
    }

    private static long percentile(List<Long> sortedValues, double percentile) {
        if (sortedValues.isEmpty()) {
            return 0;
        }
        int index = (int) Math.ceil(percentile * sortedValues.size()) - 1;
        return sortedValues.get(Math.max(0, Math.min(index, sortedValues.size() - 1)));
    }

    private static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
