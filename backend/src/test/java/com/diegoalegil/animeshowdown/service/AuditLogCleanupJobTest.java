package com.diegoalegil.animeshowdown.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AuditLogCleanupJobTest {

    private static final Clock FIXED_CLOCK =
            Clock.fixed(Instant.parse("2026-06-05T03:00:00Z"), ZoneOffset.UTC);

    @Mock private AuditLogService auditLogService;

    @Test
    void purgaConLaMarcaTemporalDelReloj() {
        when(auditLogService.purgarRetencion(any()))
                .thenReturn(new AuditLogService.PurgeResult(0L, 0L));
        AuditLogCleanupJob job = new AuditLogCleanupJob(auditLogService, FIXED_CLOCK);

        job.purgarAuditLog();

        verify(auditLogService).purgarRetencion(LocalDateTime.now(FIXED_CLOCK));
    }

    @Test
    void purgaCompletaCuandoHayBorrados() {
        when(auditLogService.purgarRetencion(any()))
                .thenReturn(new AuditLogService.PurgeResult(5L, 2L));
        AuditLogCleanupJob job = new AuditLogCleanupJob(auditLogService, FIXED_CLOCK);

        job.purgarAuditLog();

        verify(auditLogService).purgarRetencion(LocalDateTime.now(FIXED_CLOCK));
    }
}
