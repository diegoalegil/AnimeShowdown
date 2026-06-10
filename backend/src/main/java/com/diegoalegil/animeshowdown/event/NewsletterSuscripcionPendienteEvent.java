package com.diegoalegil.animeshowdown.event;

/**
 * Evento interno emitido al crear o refrescar una suscripción de newsletter
 * pendiente de confirmar.
 *
 * <p>Solo datos resueltos (sin entidades): el listener corre tras el commit,
 * cuando la sesión de persistencia que cargó la suscripción ya está cerrada.
 */
public record NewsletterSuscripcionPendienteEvent(String email, String link) {
}
