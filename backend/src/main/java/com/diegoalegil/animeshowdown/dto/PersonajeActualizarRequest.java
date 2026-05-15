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
public class PersonajeActualizarRequest {

    @Size(min = 1, max = 80, message = "El slug debe tener entre 1 y 80 caracteres")
    @Pattern(regexp = "^[A-Za-z0-9_-]+$",
            message = "El slug solo admite letras, números, guion y guion bajo")
    private String slug;

    @Size(min = 1, max = 120, message = "El nombre debe tener entre 1 y 120 caracteres")
    private String nombre;

    @Size(min = 1, max = 120, message = "El anime debe tener entre 1 y 120 caracteres")
    private String anime;

    @Size(max = 500, message = "La descripción no puede superar 500 caracteres")
    private String descripcion;

    @Size(max = 500, message = "La URL de imagen no puede superar 500 caracteres")
    private String imagenUrl;

    public PersonajeActualizarRequest() {}

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getAnime() { return anime; }
    public void setAnime(String anime) { this.anime = anime; }

    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }

    public String getImagenUrl() { return imagenUrl; }
    public void setImagenUrl(String imagenUrl) { this.imagenUrl = imagenUrl; }
}
