package com.diegoalegil.animeshowdown.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
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
    @Mock private JobLockService jobLock;

    @Test
    void sinLockNoPurga() {
        when(jobLock.intentarAdquirir(eq("audit_log_cleanup"), any())).thenReturn(false);
        AuditLogCleanupJob job = new AuditLogCleanupJob(auditLogService, FIXED_CLOCK, jobLock);

        job.purgarAuditLog();

        verify(auditLogService, never()).purgarRetencion(any());
    }

    @Test
    void purgaConLaMarcaTemporalDelReloj() {
        when(jobLock.intentarAdquirir(eq("audit_log_cleanup"), any())).thenReturn(true);
        when(auditLogService.purgarRetencion(any()))
                .thenReturn(new AuditLogService.PurgeResult(0L, 0L));
        AuditLogCleanupJob job = new AuditLogCleanupJob(auditLogService, FIXED_CLOCK, jobLock);

        job.purgarAuditLog();

        verify(auditLogService).purgarRetencion(LocalDateTime.now(FIXED_CLOCK));
    }

    @Test
    void purgaCompletaCuandoHayBorrados() {
        when(jobLock.intentarAdquirir(eq("audit_log_cleanup"), any())).thenReturn(true);
        when(auditLogService.purgarRetencion(any()))
                .thenReturn(new AuditLogService.PurgeResult(5L, 2L));
        AuditLogCleanupJob job = new AuditLogCleanupJob(auditLogService, FIXED_CLOCK, jobLock);

        job.purgarAuditLog();

        verify(auditLogService).purgarRetencion(LocalDateTime.now(FIXED_CLOCK));
    }

    @Test
    void falloDePurgaNoPropaga() {
        when(jobLock.intentarAdquirir(eq("audit_log_cleanup"), any())).thenReturn(true);
        doThrow(new RuntimeException("tabla ocupada")).when(auditLogService).purgarRetencion(any());
        AuditLogCleanupJob job = new AuditLogCleanupJob(auditLogService, FIXED_CLOCK, jobLock);

        job.purgarAuditLog();

        verify(auditLogService).purgarRetencion(LocalDateTime.now(FIXED_CLOCK));
    }
}
