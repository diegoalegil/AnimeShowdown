package com.diegoalegil.animeshowdown.model;

/**
 * Estado de verificación del email de un usuario.
 *
 * Default para usuarios pre-existentes y para tests: ACTIVO (no se les
 * penaliza retroactivamente). El AuthController.registro fuerza PENDIENTE
 * para registros nuevos hasta que el usuario click en el link de
 * verificación recibido por email.
 */
public enum EstadoVerificacion {
    /** Registrado pero no ha verificado email. No puede votar. */
    PENDIENTE,
    /** Email verificado. Acceso completo. */
    ACTIVO
}
