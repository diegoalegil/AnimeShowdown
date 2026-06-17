package com.diegoalegil.animeshowdown.model;

import java.time.LocalDateTime;

import lombok.Getter;
import lombok.Setter;

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
@Getter
public class DueloLiveRonda {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Setter
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "duelo_id", nullable = false)
    private DueloLive duelo;

    @Setter
    @Column(nullable = false)
    private int numero;

    @Setter
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DueloLiveRondaEstado estado = DueloLiveRondaEstado.IN_PROGRESS;

    @Setter
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "personaje_a_id", nullable = false)
    private Personaje personajeA;

    @Setter
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "personaje_b_id", nullable = false)
    private Personaje personajeB;

    @Setter
    @Column(name = "abre_en", nullable = false)
    private LocalDateTime abreEn;

    @Setter
    @Column(name = "cierra_en", nullable = false)
    private LocalDateTime cierraEn;

    // length=10 (no length=1) porque el enum DueloLiveChoice incluye EMPATE
    // (6 chars). Aunque /votar rechaza EMPATE con BAD_REQUEST y en esta
    // columna solo aterrizan 'A' o 'B', Hibernate valida el schema contra
    // el tipo del campo (no contra el subset que llega en runtime) y para
    // ese tipo necesita una columna capaz de almacenar el valor más largo.
    // V25 dejó la columna VARCHAR(1) -> Hibernate ddl-auto=validate fallaba
    // contra Postgres real. V29 amplía a VARCHAR(10) y aquí alineamos.
    @Setter
    @Enumerated(EnumType.STRING)
    @Column(name = "voto_jugador1", length = 10)
    private DueloLiveChoice votoJugador1;

    @Setter
    @Enumerated(EnumType.STRING)
    @Column(name = "voto_jugador2", length = 10)
    private DueloLiveChoice votoJugador2;

    @Setter
    @Column(name = "voto_jugador1_en")
    private LocalDateTime votoJugador1En;

    @Setter
    @Column(name = "voto_jugador2_en")
    private LocalDateTime votoJugador2En;

    @Setter
    @Enumerated(EnumType.STRING)
    @Column(name = "eleccion_correcta", length = 8)
    private DueloLiveChoice eleccionCorrecta;

    @Setter
    @Column(name = "jugador1_acerto")
    private Boolean jugador1Acerto;

    @Setter
    @Column(name = "jugador2_acerto")
    private Boolean jugador2Acerto;

    @Setter
    @Column(name = "decision_ms")
    private Long decisionMs;

    @Setter
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
}
