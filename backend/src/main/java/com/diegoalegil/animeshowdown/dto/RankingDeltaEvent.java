package com.diegoalegil.animeshowdown.dto;

/**
 * Delta público del ranking tras un voto.
 *
 * <p>publica cuatro métricas
 * para que el frontend mantenga su caché live alineada con el ORDER BY
 * REST sin contaminar ventanas temporales con totales históricos:
 *
 * <ul>
 *   <li>{@code votos}: total all-time visible del personaje. Voto normal
 *       suma 1; empate neutral suma 0.5 a cada lado.</li>
 *   <li>{@code delta}: votos visibles añadidos por este evento.</li>
 *   <li>{@code pesoVotos}: total all-time PONDERADO del personaje
 *       (SUM(v.peso)). El frontend lo usa para reemplazar el valor en
 *       la caché del periodo='all'.</li>
 *   <li>{@code deltaPeso}: peso del voto RECIÉN registrado (1.00 registrado,
 *       0.30 anónimo; en empate se reparte como 0.50/0.15 por participante).
 *       El frontend lo SUMA al pesoVotos de la caché en ventanas temporales
 *       (mes, trimestre, año). Antes el hook
 *       restaba pesoVotos absoluto contra el de la caché temporal y
 *       contaminaba el ranking mensual con totales históricos.</li>
 * </ul>
 *
 * <p>Constructores legacy se preservan para retro-compat con tests y
 * consumers antiguos. Las queries y emisores nuevos deberían usar el
 * constructor de 5 parámetros para que tanto pesoVotos como deltaPeso
 * lleguen al frontend.
 */
public class RankingDeltaEvent {

    private PersonajeMiniDto personaje;
    private double votos;
    private double delta;
    private Double pesoVotos;
    private Double deltaPeso;

    public RankingDeltaEvent() {
    }

    public RankingDeltaEvent(PersonajeMiniDto personaje, double votos, double delta) {
        this(personaje, votos, delta, (double) votos, (double) delta);
    }

    public RankingDeltaEvent(PersonajeMiniDto personaje, double votos, double delta, Double pesoVotos) {
        this(personaje, votos, delta, pesoVotos, (double) delta);
    }

    public RankingDeltaEvent(PersonajeMiniDto personaje, double votos, double delta,
            Double pesoVotos, Double deltaPeso) {
        this.personaje = personaje;
        this.votos = votos;
        this.delta = delta;
        this.pesoVotos = pesoVotos == null ? (double) votos : pesoVotos;
        this.deltaPeso = deltaPeso == null ? (double) delta : deltaPeso;
    }

    public PersonajeMiniDto getPersonaje() {
        return personaje;
    }

    public double getVotos() {
        return votos;
    }

    public double getDelta() {
        return delta;
    }

    public Double getPesoVotos() {
        return pesoVotos;
    }

    public Double getDeltaPeso() {
        return deltaPeso;
    }
}
