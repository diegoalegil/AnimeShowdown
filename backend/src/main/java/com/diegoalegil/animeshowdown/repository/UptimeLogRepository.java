package com.diegoalegil.animeshowdown.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.UptimeLog;

public interface UptimeLogRepository extends JpaRepository<UptimeLog, Long> {

    List<UptimeLog> findByCheckedAtAfterOrderByCheckedAtAsc(LocalDateTime checkedAt);

    UptimeLog findTopByOrderByCheckedAtDesc();

    @Modifying
    @Query("DELETE FROM UptimeLog u WHERE u.checkedAt < :antesDe")
    int deleteOlderThan(@Param("antesDe") LocalDateTime antesDe);
}
