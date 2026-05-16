package com.diegoalegil.animeshowdown.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.diegoalegil.animeshowdown.model.AuditLog;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    // El uso típico es solo escritura (audit no se consulta desde código de
    // producto). El dashboard admin del Bloque 11/16 añadirá finders por
    // usuario, evento o rango de fechas cuando llegue.
}
