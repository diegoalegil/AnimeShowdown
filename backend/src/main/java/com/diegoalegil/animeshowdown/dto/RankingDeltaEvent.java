package com.diegoalegil.animeshowdown.dto;

/**
 * Delta público del ranking tras un voto. En AnimeShowdown el ranking
 * server-side actual usa votos acumulados como métrica competitiva.
 */
public class RankingDeltaEvent {

    private PersonajeMiniDto personaje;
    private long votos;
    private long delta;

    public RankingDeltaEvent() {
    }

    public RankingDeltaEvent(PersonajeMiniDto personaje, long votos, long delta) {
        this.personaje = personaje;
        this.votos = votos;
        this.delta = delta;
    }

    public PersonajeMiniDto getPersonaje() {
        return personaje;
    }

    public long getVotos() {
        return votos;
    }

    public long getDelta() {
        return delta;
    }
}
