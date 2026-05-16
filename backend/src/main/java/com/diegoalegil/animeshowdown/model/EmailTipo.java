package com.diegoalegil.animeshowdown.model;

/**
 * Tipo de email enviado por EmailService (Plan v2 §2.12). Se persiste en
 * la dead letter queue cuando un envío falla tras los retries, para que
 * el admin pueda priorizar manualmente cuáles reintentar.
 *
 * RESET_PASSWORD y VERIFICACION son los más sensibles porque el usuario
 * está bloqueado esperando el correo (no puede recuperar acceso ni votar
 * sin ellos).
 */
public enum EmailTipo {
    RESET_PASSWORD,
    VERIFICACION,
    /** Catch-all para envíos futuros (newsletter, notificaciones). */
    OTROS
}
