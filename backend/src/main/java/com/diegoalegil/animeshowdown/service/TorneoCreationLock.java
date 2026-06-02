package com.diegoalegil.animeshowdown.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class TorneoCreationLock {

    private static final String LOCK_KEY = "torneo_creation";

    private final JdbcTemplate jdbcTemplate;

    public TorneoCreationLock(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void bloquearCreacionTorneos() {
        jdbcTemplate.queryForObject(
                "SELECT clave FROM torneo_operacion_lock WHERE clave = ? FOR UPDATE",
                String.class,
                LOCK_KEY);
    }
}
