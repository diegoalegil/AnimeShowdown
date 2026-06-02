package com.diegoalegil.animeshowdown.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class SocialOperationLock {

    private final JdbcTemplate jdbcTemplate;

    public SocialOperationLock(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void favoritos() {
        bloquear("personajes_favoritos");
    }

    public void seguidores() {
        bloquear("seguidores");
    }

    public void pushSubscriptions() {
        bloquear("push_subscription");
    }

    public void reacciones() {
        bloquear("reacciones");
    }

    private void bloquear(String clave) {
        jdbcTemplate.queryForObject(
                "SELECT clave FROM social_operacion_lock WHERE clave = ? FOR UPDATE",
                String.class,
                clave);
    }
}
