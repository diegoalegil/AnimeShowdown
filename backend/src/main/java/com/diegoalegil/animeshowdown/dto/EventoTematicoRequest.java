package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

// Topes de longitud (defensa: el endpoint es admin pero @Valid faltaba, así que
// cadenas sin límite llegaban sin recortar). Los máximos siguen las columnas de
// la BBDD para no rechazar nada que la BBDD aceptaría. @Valid en los records
// anidados hace que sus @Size también se validen (cascada).
public record EventoTematicoRequest(
        @Size(max = 80) String slug,
        @Size(max = 120) String titulo,
        @Size(max = 500) String descripcionCorta,
        @Valid Tipo tipo,
        @Size(max = 40) String inicioISO,
        @Size(max = 40) String finISO,
        @Size(max = 32) String color,
        @Size(max = 16) String emoji,
        Boolean activo,
        @Valid Cup cup,
        @Valid Recompensa recompensa) {

    public record Tipo(@Size(max = 40) String kind, Object valor) {}

    public record Cup(Boolean enabled, Integer tamano, @Size(max = 120) String nombre) {}

    /** Recompensas de la copa del evento (las 4, todas opcionales). */
    public record Recompensa(Integer moneda, @Size(max = 120) String cartaEspecialSlug,
            @Size(max = 80) String badgeCodigo, Boolean sobreGratis) {}
}
