package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;

import com.diegoalegil.animeshowdown.model.Comentario;
import com.diegoalegil.animeshowdown.model.ComentarioEstado;

public record ComentarioDto(
        Long id,
        String personajeSlug,
        String contenido,
        ComentarioEstado estado,
        UsuarioPublicoDto autor,
        LocalDateTime creadoEn,
        LocalDateTime actualizadoEn,
        int reportes,
        boolean mio) {

    public static ComentarioDto from(Comentario comentario, boolean mio) {
        return new ComentarioDto(
                comentario.getId(),
                comentario.getPersonajeSlug(),
                comentario.getContenido(),
                comentario.getEstado(),
                UsuarioPublicoDto.from(comentario.getAutor()),
                comentario.getCreadoEn(),
                comentario.getActualizadoEn(),
                comentario.getReportes(),
                mio);
    }
}
