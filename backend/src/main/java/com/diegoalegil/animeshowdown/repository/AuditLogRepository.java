package com.diegoalegil.animeshowdown.repository;

import java.time.LocalDateTime;
import java.util.Collection;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

import com.diegoalegil.animeshowdown.model.AuditEvento;
import com.diegoalegil.animeshowdown.model.AuditLog;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    // El uso típico es solo escritura (revisión no se consulta desde código de
    // producto). El dashboard admin de la capa correspondiente/16 añadirá finders por
    // usuario, evento o rango de fechas cuando llegue.
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    long deleteByEventoInAndTsBefore(Collection<AuditEvento> eventos, LocalDateTime cutoff);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    long deleteByTsBefore(LocalDateTime cutoff);
}
