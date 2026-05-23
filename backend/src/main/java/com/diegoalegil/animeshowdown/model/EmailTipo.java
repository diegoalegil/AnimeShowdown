package com.diegoalegil.animeshowdown.model;

/**
 * Tipo de email enviado por EmailService. Se persiste en
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
    /** Confirmación double opt-in de newsletter. */
    NEWSLETTER_CONFIRMACION,
    /** Catch-all para envíos futuros (digest semanal, notificaciones, etc.). */
    OTROS
}
