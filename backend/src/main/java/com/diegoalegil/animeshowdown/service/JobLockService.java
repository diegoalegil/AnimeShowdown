package com.diegoalegil.animeshowdown.service;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lock de ejecución de jobs {@code @Scheduled} para despliegues multi-instancia.
 *
 * <p>"Claim atómico" no bloqueante (ShedLock-lite): {@link #intentarAdquirir}
 * hace un único UPDATE que marca {@code ejecutado_en} solo si han pasado &gt;=
 * {@code ttl} desde la última ejecución. El row-lock del UPDATE serializa a las
 * instancias que disparan el job a la vez: la primera gana (rowcount 1), las
 * demás ven la fila ya reclamada dentro del TTL (rowcount 0) y saltan. Evita
 * trabajo duplicado al escalar horizontalmente sin bloqueos largos ni
 * dependencias externas (Redis/ShedLock).
 *
 * <p>Hoy el deploy es mono-instancia, así que esto es defensa a futuro. El
 * claim ocurre ANTES de ejecutar el job: si el job casca tras reclamar, el
 * slot queda marcado y la siguiente ejecución dentro del TTL se salta (preferimos
 * saltar una ronda a arriesgar duplicados — relevante para las notificaciones).
 */
@Service
public class JobLockService {

    private final JdbcTemplate jdbcTemplate;
    private final Clock clock;

    public JobLockService(JdbcTemplate jdbcTemplate, Clock clock) {
        this.jdbcTemplate = jdbcTemplate;
        this.clock = clock;
    }

    /**
     * Intenta reclamar el slot de ejecución de {@code clave} para esta
     * instancia. Devuelve {@code true} si lo ganó (debe ejecutar el job),
     * {@code false} si otra instancia ya lo reclamó dentro del {@code ttl}.
     *
     * <p>El umbral se calcula en Java a propósito (cross-DB: sin {@code INTERVAL}
     * ni {@code now()} específicos de Postgres/H2). La atomicidad la da el
     * row-lock del propio UPDATE, no el reloj.
     */
    @Transactional
    public boolean intentarAdquirir(String clave, Duration ttl) {
        LocalDateTime ahora = LocalDateTime.now(clock);
        LocalDateTime umbral = ahora.minus(ttl);
        int filas = jdbcTemplate.update("""
                UPDATE job_lock
                SET ejecutado_en = ?
                WHERE clave = ?
                  AND (ejecutado_en IS NULL OR ejecutado_en < ?)
                """,
                Timestamp.valueOf(ahora), clave, Timestamp.valueOf(umbral));
        return filas == 1;
    }
}
