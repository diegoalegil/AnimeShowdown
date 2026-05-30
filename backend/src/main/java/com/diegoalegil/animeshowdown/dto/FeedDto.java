package com.diegoalegil.animeshowdown.dto;

import java.util.List;

/**
 * Respuesta del feed de comunidad (B7 §2). Reutiliza {@link ActividadItemDto}
 * como item (mismo shape que el feed personal) con la autoría —username y
 * avatar del actor— dentro del {@code payload}, para que el frontend reaproveche
 * el mismo renderer.
 *
 * <ul>
 *   <li>{@code items} — actividad reciente de los usuarios seguidos, ordenada
 *       por fecha desc y paginada.</li>
 *   <li>{@code hasMore} — hay más páginas después de ésta.</li>
 *   <li>{@code sigueAAlguien} — false cuando el usuario no sigue a nadie, para
 *       que el frontend pinte el empty-state "explora usuarios" en vez de
 *       "sin actividad reciente".</li>
 * </ul>
 */
public record FeedDto(
        List<ActividadItemDto> items,
        boolean hasMore,
        boolean sigueAAlguien) {
}
