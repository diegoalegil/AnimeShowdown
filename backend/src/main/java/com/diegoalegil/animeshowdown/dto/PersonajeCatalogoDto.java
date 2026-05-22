package com.diegoalegil.animeshowdown.dto;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

import com.diegoalegil.animeshowdown.model.Personaje;

/**
 * Vista pequeña y estable del catálogo público. Evita enviar entidades JPA
 * completas cuando el frontend solo necesita pintar buscadores/listas.
 */
public class PersonajeCatalogoDto {

    private Long id;
    private String slug;
    private String nombre;
    private String anime;
    private String descripcion;
    private String imagenUrl;
    private String imagenColorDominante;

    public PersonajeCatalogoDto() {
    }

    public PersonajeCatalogoDto(Long id, String slug, String nombre, String anime,
            String descripcion, String imagenUrl, String imagenColorDominante) {
        this.id = id;
        this.slug = slug;
        this.nombre = nombre;
        this.anime = anime;
        this.descripcion = descripcion;
        this.imagenUrl = imagenUrl;
        this.imagenColorDominante = imagenColorDominante;
    }

    public static PersonajeCatalogoDto from(Personaje p) {
        return new PersonajeCatalogoDto(
                p.getId(),
                p.getSlug(),
                p.getNombre(),
                p.getAnime(),
                p.getDescripcion(),
                p.getImagenUrl(),
                p.getImagenColorDominante());
    }

    public Map<String, Object> toFieldMap(Set<String> fields) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (fields.contains("id")) out.put("id", id);
        if (fields.contains("slug")) out.put("slug", slug);
        if (fields.contains("nombre")) out.put("nombre", nombre);
        if (fields.contains("anime")) out.put("anime", anime);
        if (fields.contains("descripcion")) out.put("descripcion", descripcion);
        if (fields.contains("imagenUrl")) out.put("imagenUrl", imagenUrl);
        if (fields.contains("imagenColorDominante")) out.put("imagenColorDominante", imagenColorDominante);
        return out;
    }

    public Long getId() {
        return id;
    }

    public String getSlug() {
        return slug;
    }

    public String getNombre() {
        return nombre;
    }

    public String getAnime() {
        return anime;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public String getImagenUrl() {
        return imagenUrl;
    }

    public String getImagenColorDominante() {
        return imagenColorDominante;
    }
}
