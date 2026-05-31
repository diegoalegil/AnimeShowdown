package com.diegoalegil.animeshowdown.event;

/**
 * Evento interno emitido cuando se crea una cuenta nueva.
 *
 * <p>Se usa para lógica post-registro que debe correr después del commit en
 * flujos transaccionales como OAuth, pero también funciona en el registro
 * clásico donde no hay una transacción explícita en el controller.
 */
public record UsuarioRegistradoEvent(Long usuarioId) {
}
