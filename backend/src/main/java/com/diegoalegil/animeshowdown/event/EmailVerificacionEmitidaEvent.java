package com.diegoalegil.animeshowdown.event;

/**
 * Evento interno emitido al crear un token de verificación de email.
 *
 * <p>Solo datos resueltos (sin entidades): el listener corre tras el commit,
 * cuando la sesión de persistencia que cargó al usuario ya está cerrada.
 */
public record EmailVerificacionEmitidaEvent(String email, String username, String link) {
}
