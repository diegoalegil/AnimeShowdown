package com.diegoalegil.animeshowdown.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Table(name = "uptime_log", indexes = {
        @Index(name = "idx_uptime_log_checked_at", columnList = "checked_at"),
        @Index(name = "idx_uptime_log_status_checked_at", columnList = "status, checked_at")
})
public class UptimeLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Setter
    @Column(name = "checked_at", nullable = false)
    private LocalDateTime checkedAt;

    @Setter
    @Column(nullable = false, length = 16)
    private String status;

    @Setter
    @Column(name = "latency_ms", nullable = false)
    private Long latencyMs;

    @Setter
    @Column(length = 255)
    private String detail;

    public UptimeLog() {
    }

    public UptimeLog(LocalDateTime checkedAt, String status, Long latencyMs, String detail) {
        this.checkedAt = checkedAt;
        this.status = status;
        this.latencyMs = latencyMs;
        this.detail = detail;
    }
}
