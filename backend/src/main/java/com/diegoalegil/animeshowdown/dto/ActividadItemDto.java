package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Evento del feed "Actividad reciente" del perfil.
 *
 * <p>Tipos soportados (literal en {@code tipo}):
 * <ul>
 *   <li>{@code VOTO} — payload: {@code personajeSlug, personajeNombre,
 *       anime, oponenteSlug?, oponenteNombre?, torneoId?}.</li>
 *   <li>{@code LOGRO} — payload: {@code codigo, nombre, descripcion,
 *       icono, rareza}.</li>
 *   <li>{@code TORNEO_CREADO} — payload: {@code torneoSlug, torneoNombre,
 *       estado, estadoRevision}.</li>
 *   <li>{@code PREDICCION_ACERTADA} — payload: {@code enfrentamientoId,
 *       personajeSlug, personajeNombre, torneoSlug?, torneoNombre?}.</li>
 * </ul>
 *
 * <p>El frontend usa {@code tipo} para elegir icono y formato.
 * {@code payload} es un mapa flexible (no record fijo) para que añadir
 * tipos nuevos no rompa el contrato.
 */
public record ActividadItemDto(
        String tipo,
        LocalDateTime fecha,
        Map<String, Object> payload) {
}
