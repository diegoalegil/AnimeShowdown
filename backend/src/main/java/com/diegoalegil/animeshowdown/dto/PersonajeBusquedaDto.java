package com.diegoalegil.animeshowdown.dto;

import com.diegoalegil.animeshowdown.model.Personaje;

/**
 * Resultado de autocomplete/search. Incluye score para depurar ordenación sin
 * exponer detalles de SQL al cliente.
 */
public class PersonajeBusquedaDto extends PersonajeCatalogoDto {

    private double score;

    public PersonajeBusquedaDto() {
    }

    public PersonajeBusquedaDto(Long id, String slug, String nombre, String anime,
            String descripcion, String imagenUrl, double score) {
        super(id, slug, nombre, anime, descripcion, imagenUrl);
        this.score = score;
    }

    public static PersonajeBusquedaDto from(Personaje p, double score) {
        return new PersonajeBusquedaDto(
                p.getId(),
                p.getSlug(),
                p.getNombre(),
                p.getAnime(),
                p.getDescripcion(),
                p.getImagenUrl(),
                score);
    }

    public double getScore() {
        return score;
    }
}
