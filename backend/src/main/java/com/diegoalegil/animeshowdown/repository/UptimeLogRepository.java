package com.diegoalegil.animeshowdown.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.UptimeLog;

public interface UptimeLogRepository extends JpaRepository<UptimeLog, Long> {

    List<UptimeLog> findByCheckedAtAfterOrderByCheckedAtAsc(LocalDateTime checkedAt);

    List<UptimeLog> findTop180ByOrderByCheckedAtDesc();

    UptimeLog findTopByOrderByCheckedAtDesc();

    @Query("""
            SELECT
                COUNT(u) AS checks,
                COALESCE(SUM(CASE WHEN UPPER(u.status) = 'UP' THEN 1 ELSE 0 END), 0) AS upChecks,
                AVG(u.latencyMs) AS avgLatencyMs
            FROM UptimeLog u
            WHERE u.checkedAt >= :desde
            """)
    UptimeWindowSummary summarizeSince(@Param("desde") LocalDateTime desde);

    @Query("""
            SELECT u.latencyMs
            FROM UptimeLog u
            WHERE u.checkedAt >= :desde
            ORDER BY u.latencyMs ASC
            """)
    List<Long> findLatenciesSince(@Param("desde") LocalDateTime desde, Pageable pageable);

    @Modifying
    @Query("DELETE FROM UptimeLog u WHERE u.checkedAt < :antesDe")
    int deleteOlderThan(@Param("antesDe") LocalDateTime antesDe);

    interface UptimeWindowSummary {
        Number getChecks();

        Number getUpChecks();

        Double getAvgLatencyMs();
    }
}
