package com.diegoalegil.animeshowdown.dto;

import com.diegoalegil.animeshowdown.model.Personaje;

public class RankingItem {

    private Personaje personaje;
    private Long votos;

    public RankingItem(Personaje personaje, Long votos) {
        this.personaje = personaje;
        this.votos = votos;
    }

    public RankingItem(Long personajeId, String slug, String nombre, String anime,
            String descripcion, String imagenUrl, Long votos) {
        Personaje p = new Personaje();
        p.setId(personajeId);
        p.setSlug(slug);
        p.setNombre(nombre);
        p.setAnime(anime);
        p.setDescripcion(descripcion);
        p.setImagenUrl(imagenUrl);
        this.personaje = p;
        this.votos = votos;
    }

    public Personaje getPersonaje() {
        return personaje;
    }

    public Long getVotos() {
        return votos;
    }
}
