package com.diegoalegil.animeshowdown.model;

/**
 * Tipos de eventos auditables.
 *
 * Cada evento se persiste como una fila en audit_log con timestamp + ip
 * + user_agent + detalles JSON específicos del evento.
 *
 * Lista inicial cubre auth + sessions. Próximos bloques añadirán:
 *   - 2.3 2FA: TOTP_HABILITADO, TOTP_VERIFICADO, TOTP_FALLIDO.
 *   - 4.x: TORNEO_CREADO, BADGE_DESBLOQUEADO, REACTION_AGREGADA.
 *   - 7.1: OAUTH_LOGIN_OK por proveedor.
 */
public enum AuditEvento {
    /** Login exitoso con credenciales correctas. */
    LOGIN_OK,
    /** Login fallido (password incorrecta o usuario inexistente). */
    LOGIN_FAIL,
    /** Login rechazado porque la cuenta está bloqueada. */
    LOGIN_BLOQUEADO,
    /** Cuenta acaba de pasar a bloqueada tras 5 fallos consecutivos. */
    CUENTA_BLOQUEADA,
    /** Registro de nueva cuenta. */
    REGISTRO,
    /** Registro creado desde proveedor OAuth externo. */
    OAUTH_REGISTRO,
    /** Login/link de cuenta completado desde proveedor OAuth externo. */
    OAUTH_LOGIN_OK,
    /** Email verificado. */
    EMAIL_VERIFICADO,
    /** Reenvio del email de verificación. */
    EMAIL_VERIFICATION_REENVIADA,
    /** Cambio de password del usuario autenticado. */
    PASSWORD_CAMBIO,
    /** Solicitud de reset de password (forgot). */
    PASSWORD_RESET_SOLICITADO,
    /** Reset de password completado con código del email. */
    PASSWORD_RESET_OK,
    /** Refresh token rotado correctamente. */
    REFRESH_TOKEN_ROTADO,
    /** Detección de reuse: token revocado presentado de nuevo → defensa
     *  de revocar todas las sesiones del usuario. */
    REFRESH_TOKEN_REUSE_DETECTADO,
    /** Logout explícito (revocación del refresh actual). */
    LOGOUT,
    /** Revocación de TODAS las sesiones del usuario. */
    SESIONES_REVOCADAS_TODAS,
    /** Rol cambiado (USER ↔ ADMIN). Reservado para futuro panel admin. */
    ROL_CAMBIADO,
    /** Operación mutante ejecutada desde un endpoint administrativo. */
    ADMIN_OPERACION,
    /** El usuario activó 2FA TOTP en su cuenta. */
    TOTP_HABILITADO,
    /** El usuario desactivó 2FA TOTP. */
    TOTP_DESHABILITADO,
    /** Login con 2FA completado correctamente (paso 2 del flow). */
    TOTP_LOGIN_OK,
    /** Login con 2FA fallido: código incorrecto o expirado. */
    TOTP_LOGIN_FAIL,
    /** Login con backup code (one-shot recovery). */
    TOTP_BACKUP_CODE_USADO,
    /** El usuario regeneró su set de backup codes (invalidando los anteriores). */
    TOTP_BACKUP_CODES_REGENERADOS,
    /** Badge/logro desbloqueado por el usuario. */
    BADGE_DESBLOQUEADO,
    /** Cuenta eliminada por su propio dueño. */
    CUENTA_ELIMINADA,
    /** El usuario cambió su username (onboarding o ajustes). */
    USERNAME_CAMBIADO,
    /** El usuario editó su bio pública (B7 §1a). */
    BIO_CAMBIADA,
    /** Moneda blanda ganada por una acción de juego (drop server-authoritative). */
    MONEDA_GANADA,
    /** El usuario abrió un sobre: gastó moneda y obtuvo una carta. */
    SOBRE_ABIERTO
}
