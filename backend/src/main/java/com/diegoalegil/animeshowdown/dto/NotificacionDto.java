package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;

import com.diegoalegil.animeshowdown.model.Notificacion;
import com.diegoalegil.animeshowdown.model.NotificacionTipo;

/**
 * Vista pública de una {@link Notificacion} para el cliente (Plan v2 §2.13).
 *
 * <p>No expone el {@code Usuario} relacionado — siempre es el del request.
 * El campo {@code payload} es JSON crudo (string); el cliente lo parsea
 * según el tipo.
 */
public record NotificacionDto(
        Long id,
        NotificacionTipo tipo,
        String titulo,
        String mensaje,
        String payload,
        boolean leida,
        LocalDateTime creadoEn) {

    public static NotificacionDto from(Notificacion n) {
        return new NotificacionDto(
                n.getId(),
                n.getTipo(),
                n.getTitulo(),
                n.getMensaje(),
                n.getPayload(),
                n.isLeida(),
                n.getCreadoEn());
    }
}
