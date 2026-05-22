package com.diegoalegil.animeshowdown.dto;

/**
 * Delta público del ranking tras un voto.
 *
 * <p>Audit externo B2.1a (2026-05-22): además de {@code votos} (conteo
 * físico) publicamos {@code pesoVotos} (suma ponderada) para que el
 * frontend pueda reordenar la caché live usando la misma métrica que el
 * ORDER BY del ranking REST. Antes el frontend ordenaba por {@code votos}
 * y tras un voto anónimo el personaje saltaba como si valiera 1.0, no 0.3.
 *
 * <p>{@code votos} se mantiene para retro-compat con consumers antiguos
 * y para que la UI muestre el número de personas que votaron — la métrica
 * "humana" no engañosa.
 */
public class RankingDeltaEvent {

    private PersonajeMiniDto personaje;
    private long votos;
    private long delta;
    private Double pesoVotos;

    public RankingDeltaEvent() {
    }

    public RankingDeltaEvent(PersonajeMiniDto personaje, long votos, long delta) {
        this(personaje, votos, delta, (double) votos);
    }

    public RankingDeltaEvent(PersonajeMiniDto personaje, long votos, long delta, Double pesoVotos) {
        this.personaje = personaje;
        this.votos = votos;
        this.delta = delta;
        this.pesoVotos = pesoVotos == null ? (double) votos : pesoVotos;
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

    public Double getPesoVotos() {
        return pesoVotos;
    }
}
