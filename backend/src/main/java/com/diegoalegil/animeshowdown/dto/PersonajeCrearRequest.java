package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * DTO para crear un personaje vía POST /api/personajes (endpoint admin).
 * Antes el controller aceptaba la entidad Personaje directa sin validación,
 * permitiendo crear personajes con slug vacío, nombre null, etc.
 */
public record PersonajeCrearRequest(

        @NotBlank(message = "El slug es obligatorio")
        @Size(min = 1, max = 80, message = "El slug debe tener entre 1 y 80 caracteres")
        @Pattern(regexp = "^[A-Za-z0-9_-]+$",
                message = "El slug solo admite letras, números, guion y guion bajo")
        String slug,

        @NotBlank(message = "El nombre es obligatorio")
        @Size(min = 1, max = 120, message = "El nombre debe tener entre 1 y 120 caracteres")
        String nombre,

        @NotBlank(message = "El anime es obligatorio")
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
