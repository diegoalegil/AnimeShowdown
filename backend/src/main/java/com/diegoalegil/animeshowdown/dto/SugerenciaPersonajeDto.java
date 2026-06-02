package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;

import com.diegoalegil.animeshowdown.model.SugerenciaPersonaje;

/**
 * Respuesta de una sugerencia de personaje. Incluye {@code proponente} para la
 * vista admin; en la vista "mis sugerencias" coincide con el propio usuario.
 */
public record SugerenciaPersonajeDto(
        Long id,
        String nombre,
        String anime,
        String motivo,
        String identidad,
        String urlReferencia,
        String estado,
        String motivoRechazo,
        String proponente,
        LocalDateTime creadoEn,
        LocalDateTime revisadoEn) {

    public static SugerenciaPersonajeDto from(SugerenciaPersonaje s) {
        return new SugerenciaPersonajeDto(
                s.getId(),
                s.getNombre(),
                s.getAnime(),
                s.getMotivo(),
                s.getIdentidad(),
                s.getUrlReferencia(),
                s.getEstado() != null ? s.getEstado().name() : null,
                s.getMotivoRechazo(),
                s.getUsuario() != null ? s.getUsuario().getUsername() : null,
                s.getCreadoEn(),
                s.getRevisadoEn());
    }
}
