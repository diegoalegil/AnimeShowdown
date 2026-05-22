package com.diegoalegil.animeshowdown.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "duelos_live_rondas",
        uniqueConstraints = @UniqueConstraint(name = "uk_duelos_live_ronda_numero", columnNames = {"duelo_id", "numero"}),
        indexes = {
                @Index(name = "idx_duelos_live_rondas_duelo", columnList = "duelo_id,numero"),
                @Index(name = "idx_duelos_live_rondas_estado", columnList = "estado"),
                @Index(name = "idx_duelos_live_rondas_cierra", columnList = "cierra_en")
        })
public class DueloLiveRonda {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "duelo_id", nullable = false)
    private DueloLive duelo;

    @Column(nullable = false)
    private int numero;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DueloLiveRondaEstado estado = DueloLiveRondaEstado.IN_PROGRESS;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "personaje_a_id", nullable = false)
    private Personaje personajeA;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "personaje_b_id", nullable = false)
    private Personaje personajeB;

    @Column(name = "abre_en", nullable = false)
    private LocalDateTime abreEn;

    @Column(name = "cierra_en", nullable = false)
    private LocalDateTime cierraEn;

    // length=10 (no length=1) porque el enum DueloLiveChoice incluye EMPATE
    // (6 chars). Aunque /votar rechaza EMPATE con BAD_REQUEST y en esta
    // columna solo aterrizan 'A' o 'B', Hibernate valida el schema contra
    // el tipo del campo (no contra el subset que llega en runtime) y para
    // ese tipo necesita una columna capaz de almacenar el valor más largo.
    // V25 dejó la columna VARCHAR(1) -> Hibernate ddl-auto=validate fallaba
    // contra Postgres real. V29 amplía a VARCHAR(10) y aquí alineamos.
    @Enumerated(EnumType.STRING)
    @Column(name = "voto_jugador1", length = 10)
    private DueloLiveChoice votoJugador1;

    @Enumerated(EnumType.STRING)
    @Column(name = "voto_jugador2", length = 10)
    private DueloLiveChoice votoJugador2;

    @Column(name = "voto_jugador1_en")
    private LocalDateTime votoJugador1En;

    @Column(name = "voto_jugador2_en")
    private LocalDateTime votoJugador2En;

    @Enumerated(EnumType.STRING)
    @Column(name = "eleccion_correcta", length = 8)
    private DueloLiveChoice eleccionCorrecta;

    @Column(name = "jugador1_acerto")
    private Boolean jugador1Acerto;

    @Column(name = "jugador2_acerto")
    private Boolean jugador2Acerto;

    @Column(name = "decision_ms")
    private Long decisionMs;

    @Column(name = "cerrada_en")
    private LocalDateTime cerradaEn;

    public DueloLiveRonda() {}

    public DueloLiveRonda(DueloLive duelo, int numero, Personaje personajeA, Personaje personajeB,
            LocalDateTime abreEn, LocalDateTime cierraEn) {
        this.duelo = duelo;
        this.numero = numero;
        this.personajeA = personajeA;
        this.personajeB = personajeB;
        this.abreEn = abreEn;
        this.cierraEn = cierraEn;
    }

    public boolean ambosVotaron(boolean bot) {
        return votoJugador1 != null && (bot || votoJugador2 != null);
    }

    public Long getId() { return id; }
    public DueloLive getDuelo() { return duelo; }
    public void setDuelo(DueloLive duelo) { this.duelo = duelo; }
    public int getNumero() { return numero; }
    public void setNumero(int numero) { this.numero = numero; }
    public DueloLiveRondaEstado getEstado() { return estado; }
    public void setEstado(DueloLiveRondaEstado estado) { this.estado = estado; }
    public Personaje getPersonajeA() { return personajeA; }
    public void setPersonajeA(Personaje personajeA) { this.personajeA = personajeA; }
    public Personaje getPersonajeB() { return personajeB; }
    public void setPersonajeB(Personaje personajeB) { this.personajeB = personajeB; }
    public LocalDateTime getAbreEn() { return abreEn; }
    public void setAbreEn(LocalDateTime abreEn) { this.abreEn = abreEn; }
    public LocalDateTime getCierraEn() { return cierraEn; }
    public void setCierraEn(LocalDateTime cierraEn) { this.cierraEn = cierraEn; }
    public DueloLiveChoice getVotoJugador1() { return votoJugador1; }
    public void setVotoJugador1(DueloLiveChoice votoJugador1) { this.votoJugador1 = votoJugador1; }
    public DueloLiveChoice getVotoJugador2() { return votoJugador2; }
    public void setVotoJugador2(DueloLiveChoice votoJugador2) { this.votoJugador2 = votoJugador2; }
    public LocalDateTime getVotoJugador1En() { return votoJugador1En; }
    public void setVotoJugador1En(LocalDateTime votoJugador1En) { this.votoJugador1En = votoJugador1En; }
    public LocalDateTime getVotoJugador2En() { return votoJugador2En; }
    public void setVotoJugador2En(LocalDateTime votoJugador2En) { this.votoJugador2En = votoJugador2En; }
    public DueloLiveChoice getEleccionCorrecta() { return eleccionCorrecta; }
    public void setEleccionCorrecta(DueloLiveChoice eleccionCorrecta) { this.eleccionCorrecta = eleccionCorrecta; }
    public Boolean getJugador1Acerto() { return jugador1Acerto; }
    public void setJugador1Acerto(Boolean jugador1Acerto) { this.jugador1Acerto = jugador1Acerto; }
    public Boolean getJugador2Acerto() { return jugador2Acerto; }
    public void setJugador2Acerto(Boolean jugador2Acerto) { this.jugador2Acerto = jugador2Acerto; }
    public Long getDecisionMs() { return decisionMs; }
    public void setDecisionMs(Long decisionMs) { this.decisionMs = decisionMs; }
    public LocalDateTime getCerradaEn() { return cerradaEn; }
    public void setCerradaEn(LocalDateTime cerradaEn) { this.cerradaEn = cerradaEn; }
}
