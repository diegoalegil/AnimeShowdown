package com.diegoalegil.animeshowdown.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.model.UptimeLog;
import com.diegoalegil.animeshowdown.repository.UptimeLogRepository;

@Service
@ConditionalOnProperty(name = "app.status.monitor.enabled", havingValue = "true", matchIfMissing = true)
public class StatusMonitorService {

    private final UptimeLogRepository uptimeLogRepository;
    private final HttpClient httpClient;
    private final String healthUrl;
    private final Duration timeout;

    public StatusMonitorService(
            UptimeLogRepository uptimeLogRepository,
            @Value("${app.status.health-url:http://localhost:8080/actuator/health}") String healthUrl,
            @Value("${app.status.monitor.timeout-ms:2500}") long timeoutMs) {
        this.uptimeLogRepository = uptimeLogRepository;
        this.healthUrl = healthUrl;
        this.timeout = Duration.ofMillis(timeoutMs);
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(this.timeout)
                .build();
    }

    @Scheduled(
            fixedRateString = "${app.status.monitor.fixed-rate-ms:60000}",
            initialDelayString = "${app.status.monitor.initial-delay-ms:15000}")
    @Transactional
    public void registrarPing() {
        LocalDateTime checkedAt = LocalDateTime.now(ZoneOffset.UTC);
        long start = System.nanoTime();
        String status = "DOWN";
        String detail = null;

        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(healthUrl))
                    .timeout(timeout)
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            String body = response.body() == null ? "" : response.body();
            if (response.statusCode() >= 200 && response.statusCode() < 300 && body.contains("\"UP\"")) {
                status = "UP";
            } else if (response.statusCode() >= 200 && response.statusCode() < 300) {
                status = "DEGRADED";
                detail = left("health returned " + body, 255);
            } else {
                detail = "HTTP " + response.statusCode();
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            detail = left(e.getClass().getSimpleName() + ": " + e.getMessage(), 255);
        } catch (Exception e) {
            detail = left(e.getClass().getSimpleName() + ": " + e.getMessage(), 255);
        }

        long latencyMs = Math.max(0, Math.round((System.nanoTime() - start) / 1_000_000.0));
        uptimeLogRepository.save(new UptimeLog(checkedAt, status, latencyMs, detail));
        uptimeLogRepository.deleteOlderThan(checkedAt.minusDays(90));
    }

    private static String left(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }
}
