package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body del POST /api/sugerencias. {@code identidad} es obligatoria por
 * REGLA #7 (algo concreto: kanji, emblema o referencia real). {@code motivo}
 * y {@code urlReferencia} son opcionales.
 */
public record SugerirPersonajeRequest(

        @NotBlank(message = "El nombre es obligatorio")
        @Size(max = 120, message = "El nombre no puede superar 120 caracteres")
        String nombre,

        @NotBlank(message = "El anime es obligatorio")
        @Size(max = 120, message = "El anime no puede superar 120 caracteres")
        String anime,

        @Size(max = 1000, message = "El motivo no puede superar 1000 caracteres")
        String motivo,

        @NotBlank(message = "La identidad es obligatoria (kanji, emblema o referencia real)")
        @Size(min = 3, max = 300, message = "La identidad debe tener entre 3 y 300 caracteres")
        String identidad,

        @Size(max = 500, message = "La URL de referencia no puede superar 500 caracteres")
        String urlReferencia) {
}
