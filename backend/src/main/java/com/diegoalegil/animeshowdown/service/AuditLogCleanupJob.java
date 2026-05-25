package com.diegoalegil.animeshowdown.service;

import java.time.Clock;
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

    private final AuditLogService auditLogService;
    private final Clock clock;

    public AuditLogCleanupJob(AuditLogService auditLogService, Clock clock) {
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    @Scheduled(cron = "${app.audit.cleanup.cron:0 0 3 * * *}", zone = "UTC")
    public void purgarAuditLog() {
        AuditLogService.PurgeResult result = auditLogService.purgarRetencion(LocalDateTime.now(clock));
        if (result.totalDeleted() > 0) {
            log.info("Audit log cleanup purgo {} entradas (general={}, sensibles={})",
                    result.totalDeleted(), result.generalDeleted(), result.sensitiveDeleted());
        }
    }
}
