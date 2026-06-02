package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import com.diegoalegil.animeshowdown.dto.StatusResponseDto;
import com.diegoalegil.animeshowdown.model.UptimeLog;
import com.diegoalegil.animeshowdown.repository.UptimeLogRepository;

@ExtendWith(MockitoExtension.class)
class StatusServiceTest {

    private static final Instant NOW = Instant.parse("2026-06-01T10:15:30Z");
    private static final LocalDateTime NOW_UTC = LocalDateTime.ofInstant(NOW, ZoneOffset.UTC);

    @org.mockito.Mock
    private UptimeLogRepository uptimeLogRepository;

    @Test
    void resumenPublicoUsaAgregadosLimitadosYCacheCorto() {
        StatusService service = new StatusService(
                uptimeLogRepository,
                Clock.fixed(NOW, ZoneOffset.UTC));

        when(uptimeLogRepository.findTopByOrderByCheckedAtDesc())
                .thenReturn(new UptimeLog(NOW_UTC.minusMinutes(1), "UP", 120L, null));
        when(uptimeLogRepository.summarizeSince(any(LocalDateTime.class)))
                .thenReturn(new WindowSummary(3, 2, 400.0));
        when(uptimeLogRepository.findLatenciesSince(any(LocalDateTime.class), any(Pageable.class)))
                .thenReturn(List.of(180L));
        when(uptimeLogRepository.findTop180ByOrderByCheckedAtDesc())
                .thenReturn(List.of(
                        new UptimeLog(NOW_UTC.minusMinutes(1), "UP", 180L, null),
                        new UptimeLog(NOW_UTC.minusMinutes(2), "DOWN", 900L, null)));

        StatusResponseDto first = service.resumenPublico();
        StatusResponseDto second = service.resumenPublico();

        assertThat(second).isSameAs(first);
        assertThat(first.last24h().checks()).isEqualTo(3);
        assertThat(first.last24h().uptimePercent()).isEqualTo(66.67);
        assertThat(first.last24h().p50LatencyMs()).isEqualTo(180);
        assertThat(first.samples()).extracting(sample -> sample.checkedAt())
                .containsExactly(NOW_UTC.minusMinutes(2), NOW_UTC.minusMinutes(1));

        verify(uptimeLogRepository).findTopByOrderByCheckedAtDesc();
        verify(uptimeLogRepository, times(4)).summarizeSince(any(LocalDateTime.class));
        verify(uptimeLogRepository, times(4)).findLatenciesSince(any(LocalDateTime.class), any(Pageable.class));
        verify(uptimeLogRepository).findTop180ByOrderByCheckedAtDesc();
        verify(uptimeLogRepository, never()).findByCheckedAtAfterOrderByCheckedAtAsc(any(LocalDateTime.class));
    }

    private record WindowSummary(long checks, long upChecks, Double avgLatencyMs)
            implements UptimeLogRepository.UptimeWindowSummary {

        @Override
        public Number getChecks() {
            return checks;
        }

        @Override
        public Number getUpChecks() {
            return upChecks;
        }

        @Override
        public Double getAvgLatencyMs() {
            return avgLatencyMs;
        }
    }
}
