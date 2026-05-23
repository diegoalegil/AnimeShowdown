package com.diegoalegil.animeshowdown.model;

/**
 * Tipos de notificación in-app persistentes.
 *
 * <p>Cada tipo conlleva un template de título/mensaje que vive en el sitio
 * que dispara la notificación (no aquí — para que cada feature controle su
 * propio copy). El frontend usa el tipo para elegir icono + color del item
 * en la campanita.
 *
 * <p>Lista inicial corta: solo lo que está disponible hoy. Bloques 4.x
 * añadirán BADGE_DESBLOQUEADO, PREDICCION_ACERTADA, SEGUIDOR_NUEVO, etc.
 */
public enum NotificacionTipo {
    /** Bienvenida tras verificar email. Trigger en EmailVerificationService. */
    BIENVENIDA,
    /** Torneo iniciado — broadcast global, pero al admin creador también
     *  va como notificación persistente para que tenga registro. */
    TORNEO_INICIADO,
    /** Torneo finalizado — al admin creador, con link al ganador. */
    TORNEO_FINALIZADO,
    /** Badge/logro desbloqueado. Payload con codigo+icono+rareza. */
    BADGE_DESBLOQUEADO,
    /** Alguien ha empezado a seguir al usuario. */
    SEGUIDOR_NUEVO,
    /** Admin aprobó el torneo creado por el usuario. */
    TORNEO_APROBADO,
    /** Admin rechazó el torneo creado por el usuario. */
    TORNEO_RECHAZADO,
    /** Genérica del sistema (anuncios admin, mantenimiento, etc). */
    SISTEMA
}
