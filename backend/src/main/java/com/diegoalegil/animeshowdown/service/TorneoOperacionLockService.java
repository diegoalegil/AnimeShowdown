package com.diegoalegil.animeshowdown.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lock transaccional por torneo para serializar operaciones que no deben
 * solaparse aunque el cierre de bracket use transacciones internas.
 */
@Service
public class TorneoOperacionLockService {

    private final JdbcTemplate jdbcTemplate;

    public TorneoOperacionLockService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void lock(Long torneoId) {
        jdbcTemplate.update("""
                INSERT INTO torneo_operacion_locks (torneo_id)
                VALUES (?)
                ON CONFLICT DO NOTHING
                """, torneoId);
        jdbcTemplate.queryForObject("""
                SELECT torneo_id
                FROM torneo_operacion_locks
                WHERE torneo_id = ?
                FOR UPDATE
                """, Long.class, torneoId);
    }
}
