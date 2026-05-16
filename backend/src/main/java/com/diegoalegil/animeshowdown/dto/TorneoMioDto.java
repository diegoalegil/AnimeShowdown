package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;

import com.diegoalegil.animeshowdown.model.EstadoRevision;
import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.Torneo;

/**
 * Vista de "Mis torneos" para el perfil del creador (Plan v2 §4.9).
 *
 * <p>Incluye el estado de revisión y el motivo de rechazo (cuando aplica)
 * para que el frontend pueda pintar:
 * <ul>
 *   <li>Pill amarillo "Pendiente" si {@code estadoRevision = PENDIENTE}.</li>
 *   <li>Pill rojo + tooltip con {@code motivoRechazo} si RECHAZADO.</li>
 *   <li>Pill verde + link al torneo si APROBADO o NO_APLICA.</li>
 * </ul>
 * No expone bracket completo — el link "abrir" lleva al detalle público
 * cuando está aprobado.
 */
public record TorneoMioDto(
        Long id,
        String slug,
        String nombre,
        String descripcion,
        EstadoTorneo estado,
        EstadoRevision estadoRevision,
        String motivoRechazo,
        LocalDateTime fechaCreacion,
        LocalDateTime fechaRevisado) {

    public static TorneoMioDto from(Torneo t) {
        return new TorneoMioDto(
                t.getId(),
                t.getSlug(),
                t.getNombre(),
                t.getDescripcion(),
                t.getEstado(),
                t.getEstadoRevision(),
                t.getMotivoRechazo(),
                t.getFechaCreacion(),
                t.getFechaRevisado());
    }
}
