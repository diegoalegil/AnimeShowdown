package com.diegoalegil.animeshowdown.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.EmailFailure;

public interface EmailFailureRepository extends JpaRepository<EmailFailure, Long> {

    /** Listado ordenado más reciente primero — para el dashboard admin. */
    List<EmailFailure> findAllByOrderByTsDesc();

    /** Cuenta de fallos no reintentados — métrica de severidad rápida. */
    long countByReintentadoFalse();

    /**
     * Cuenta fallos sin reintentar pero ACOTADA a {@code cap}: devuelve
     * {@code min(total, cap)}. Para el healthcheck, que solo necesita saber si
     * hay "demasiados" (≥ umbral): el LIMIT corta el escaneo en {@code cap}
     * filas, así que un /actuator/health público no amplifica a un seq-scan de
     * toda la cola durante una caída de Resend (cuando la tabla crece) — la
     * tabla no tiene índice en {@code reintentado}. O(cap), no O(tabla).
     */
    @Query(value = """
            SELECT COUNT(*) FROM (
                SELECT 1 FROM email_failed_queue WHERE reintentado = false LIMIT :cap
            ) t
            """, nativeQuery = true)
    long countPendientesHasta(@Param("cap") int cap);
}
