package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;

import com.diegoalegil.animeshowdown.model.Logro;
import com.diegoalegil.animeshowdown.model.UsuarioLogro;

/**
 * Vista de un badge para el cliente (Plan v2 §4.2).
 *
 * <p>{@code desbloqueadoEn} es null cuando se devuelve un badge del
 * catálogo que el usuario aún NO ha desbloqueado (el frontend lo pinta
 * atenuado/gris). Si está presente, indica cuándo lo consiguió.
 */
public record LogroDto(
        Long id,
        String codigo,
        String nombre,
        String descripcion,
        String icono,
        Short rareza,
        LocalDateTime desbloqueadoEn) {

    public static LogroDto deCatalogo(Logro l) {
        return new LogroDto(l.getId(), l.getCodigo(), l.getNombre(),
                l.getDescripcion(), l.getIcono(), l.getRareza(), null);
    }

    public static LogroDto desbloqueado(UsuarioLogro ul) {
        Logro l = ul.getLogro();
        return new LogroDto(l.getId(), l.getCodigo(), l.getNombre(),
                l.getDescripcion(), l.getIcono(), l.getRareza(),
                ul.getDesbloqueadoEn());
    }
}
