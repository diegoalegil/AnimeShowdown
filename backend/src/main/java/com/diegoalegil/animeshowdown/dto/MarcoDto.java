package com.diegoalegil.animeshowdown.dto;

import com.diegoalegil.animeshowdown.model.Marco;

/**
 * Marco del catálogo enriquecido con el estado del usuario autenticado:
 * {@code poseido} (ya lo compró) y {@code equipado} (es el activo ahora).
 */
public record MarcoDto(
        String id,
        String nombre,
        String descripcion,
        long precio,
        String rareza,
        String estilo,
        boolean poseido,
        boolean equipado) {

    public static MarcoDto from(Marco marco, boolean poseido, boolean equipado) {
        return new MarcoDto(
                marco.id(),
                marco.nombre(),
                marco.descripcion(),
                marco.precio(),
                marco.rareza(),
                marco.estilo(),
                poseido,
                equipado);
    }
}
