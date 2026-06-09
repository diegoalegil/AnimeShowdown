package com.diegoalegil.animeshowdown.event;

/**
 * Evento interno emitido al generar un código de reset de password.
 *
 * <p>Solo datos resueltos (sin entidades): el listener corre tras el commit,
 * cuando la sesión de persistencia que cargó al usuario ya está cerrada.
 */
public record PasswordResetSolicitadoEvent(String email, String username, String codigo) {
}
