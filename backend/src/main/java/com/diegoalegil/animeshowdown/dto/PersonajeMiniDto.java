package com.diegoalegil.animeshowdown.dto;

import com.diegoalegil.animeshowdown.model.Personaje;

/**
 * Vista mínima de Personaje para embebido en respuestas de torneos. Evita
 * exponer descripcion/elo/relaciones cuando el frontend solo necesita el
 * slug, nombre, anime e imagen para pintar la carta del bracket.
 *
 * Pasa por TorneoQueryService para mapping; entidades JPA nunca llegan
 * crudas al cliente en endpoints públicos.
 */
public class PersonajeMiniDto {

    private Long id;
    private String slug;
    private String nombre;
    private String anime;
    private String imagenUrl;
    private String imagenColorDominante;

    public PersonajeMiniDto() {
    }

    public static PersonajeMiniDto from(Personaje p) {
        if (p == null) {
            return null;
        }
        PersonajeMiniDto dto = new PersonajeMiniDto();
        dto.id = p.getId();
        dto.slug = p.getSlug();
        dto.nombre = p.getNombre();
        dto.anime = p.getAnime();
        dto.imagenUrl = p.getImagenUrl();
        // Color dominante del arte: el frontend lo usa de fondo de la carta
        // (VoteCard/VoteQuoteCard, brackets) para que el recorte transparente
        // no quede sobre un cuadro gris. Ya estaba en BD; faltaba exponerlo aquí.
        dto.imagenColorDominante = p.getImagenColorDominante();
        return dto;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public String getAnime() {
        return anime;
    }

    public void setAnime(String anime) {
        this.anime = anime;
    }

    public String getImagenUrl() {
        return imagenUrl;
    }

    public void setImagenUrl(String imagenUrl) {
        this.imagenUrl = imagenUrl;
    }

    public String getImagenColorDominante() {
        return imagenColorDominante;
    }

    public void setImagenColorDominante(String imagenColorDominante) {
        this.imagenColorDominante = imagenColorDominante;
    }
}
