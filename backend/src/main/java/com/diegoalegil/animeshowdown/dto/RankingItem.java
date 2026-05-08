package com.diegoalegil.animeshowdown.dto;

import com.diegoalegil.animeshowdown.model.Personaje;

public class RankingItem {

    private Personaje personaje;
    private Long votos;

    public RankingItem(Personaje personaje, Long votos) {
        this.personaje = personaje;
        this.votos = votos;
    }

    public Personaje getPersonaje() {
        return personaje;
    }

    public Long getVotos() {
        return votos;
    }
}