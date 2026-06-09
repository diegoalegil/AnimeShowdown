package com.diegoalegil.animeshowdown.service;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(name = "app.audit.cleanup.enabled", havingValue = "true", matchIfMissing = true)
public class AuditLogCleanupJob {

    private static final Logger log = LoggerFactory.getLogger(AuditLogCleanupJob.class);
    private static final Duration LOCK_TTL = Duration.ofHours(20);

    private final AuditLogService auditLogService;
    private final Clock clock;
    private final JobLockService jobLock;

    public AuditLogCleanupJob(AuditLogService auditLogService, Clock clock, JobLockService jobLock) {
        this.auditLogService = auditLogService;
        this.clock = clock;
        this.jobLock = jobLock;
    }

    @Scheduled(cron = "${app.audit.cleanup.cron:0 0 3 * * *}", zone = "UTC")
    public void purgarAuditLog() {
        if (!jobLock.intentarAdquirir("audit_log_cleanup", LOCK_TTL)) {
            return; // otra instancia ya purgo audit log en este slot diario
        }
        try {
            AuditLogService.PurgeResult result = auditLogService.purgarRetencion(LocalDateTime.now(clock));
            if (result.totalDeleted() > 0) {
                log.info("Audit log cleanup purgo {} entradas (general={}, sensibles={})",
                        result.totalDeleted(), result.generalDeleted(), result.sensitiveDeleted());
            }
        } catch (Exception e) {
            log.warn("Audit log cleanup fallo: {}", e.getMessage());
        }
    }
}
