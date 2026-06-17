package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * DTO para PUT /api/personajes/{id}. Todos los campos son opcionales: la
 * implementación del controller hace merge parcial (solo sobreescribe los
 * campos non-null del body), preservando los demás.
 *
 * Las validaciones son solo de formato y tamaño — no obligan a estar presentes.
 */
public record PersonajeActualizarRequest(

        @Size(min = 1, max = 80, message = "El slug debe tener entre 1 y 80 caracteres")
        @Pattern(regexp = "^[A-Za-z0-9_-]+$",
                message = "El slug solo admite letras, números, guion y guion bajo")
        String slug,

        @Size(min = 1, max = 120, message = "El nombre debe tener entre 1 y 120 caracteres")
        String nombre,

        @Size(min = 1, max = 120, message = "El anime debe tener entre 1 y 120 caracteres")
        String anime,

        @Size(max = 500, message = "La descripción no puede superar 500 caracteres")
        String descripcion,

        @Size(max = 500, message = "La URL de imagen no puede superar 500 caracteres")
        // Solo http(s) o rutas locales de assets: corta XSS/SSRF sembrado por
        // un admin comprometido (javascript:, data:, file:, etc.).
        @Pattern(regexp = "^(https?://|/(img|assets)/).*", message = "La imagen debe ser http(s) o una ruta /img|/assets")
        String imagenUrl) {
}
