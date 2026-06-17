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
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Table(name = "duelos_live", indexes = {
        @Index(name = "idx_duelos_live_estado", columnList = "estado"),
        @Index(name = "idx_duelos_live_estado_creado", columnList = "estado,creado_en"),
        @Index(name = "idx_duelos_live_estado_elo_creado", columnList = "estado,jugador1_elo_before,creado_en"),
        @Index(name = "idx_duelos_live_jugador1", columnList = "jugador1_id"),
        @Index(name = "idx_duelos_live_jugador2", columnList = "jugador2_id"),
        @Index(name = "idx_duelos_live_creado", columnList = "creado_en"),
        @Index(name = "idx_duelos_live_finished", columnList = "finished_en")
})
public class DueloLive {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Setter
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DueloLiveEstado estado = DueloLiveEstado.WAITING;

    @Setter
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "jugador1_id")
    private Usuario jugador1;

    @Setter
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "jugador2_id")
    private Usuario jugador2;

    @Setter
    @Column(name = "jugador2_bot", nullable = false)
    private boolean jugador2Bot = false;

    @Setter
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ganador_id")
    private Usuario ganador;

    @Setter
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "abandonador_id")
    private Usuario abandonador;

    @Setter
    @Column(name = "ronda_actual", nullable = false)
    private int rondaActual = 0;

    @Setter
    @Column(name = "score_jugador1", nullable = false)
    private int scoreJugador1 = 0;

    @Setter
    @Column(name = "score_jugador2", nullable = false)
    private int scoreJugador2 = 0;

    @Setter
    @Column(name = "rondas_validas", nullable = false)
    private int rondasValidas = 0;

    @Setter
    @Column(name = "jugador1_elo_before", nullable = false)
    private int jugador1EloBefore = 1000;

    @Setter
    @Column(name = "jugador2_elo_before", nullable = false)
    private int jugador2EloBefore = 1000;

    @Setter
    @Column(name = "jugador1_elo_after")
    private Integer jugador1EloAfter;

    @Setter
    @Column(name = "jugador2_elo_after")
    private Integer jugador2EloAfter;

    @Setter
    @Column(name = "jugador1_ip", length = 64)
    private String jugador1Ip;

    @Setter
    @Column(name = "jugador2_ip", length = 64)
    private String jugador2Ip;

    @Setter
    @Column(name = "creado_en", nullable = false)
    private LocalDateTime creadoEn;

    @Setter
    @Column(name = "matched_en")
    private LocalDateTime matchedEn;

    @Setter
    @Column(name = "started_en")
    private LocalDateTime startedEn;

    @Setter
    @Column(name = "finished_en")
    private LocalDateTime finishedEn;

    @Setter
    @Column(name = "abandoned_en")
    private LocalDateTime abandonedEn;

    @Setter
    @Column(name = "last_seen_jugador1")
    private LocalDateTime lastSeenJugador1;

    @Setter
    @Column(name = "last_seen_jugador2")
    private LocalDateTime lastSeenJugador2;

    public DueloLive() {}

    public DueloLive(Usuario jugador1, String jugador1Ip, LocalDateTime creadoEn) {
        this.jugador1 = jugador1;
        this.jugador1Ip = jugador1Ip;
        this.creadoEn = creadoEn;
        this.lastSeenJugador1 = creadoEn;
        this.jugador1EloBefore = jugador1.getEloPvp();
    }

    @PrePersist
    protected void onCreate() {
        if (creadoEn == null) {
            creadoEn = LocalDateTime.now();
        }
        if (lastSeenJugador1 == null) {
            lastSeenJugador1 = creadoEn;
        }
    }

    public boolean participa(Usuario usuario) {
        if (usuario == null || usuario.getId() == null) return false;
        return jugador1 != null && usuario.getId().equals(jugador1.getId())
                || jugador2 != null && usuario.getId().equals(jugador2.getId());
    }

    public boolean esJugador1(Usuario usuario) {
        return usuario != null && jugador1 != null && usuario.getId().equals(jugador1.getId());
    }

    public boolean esJugador2(Usuario usuario) {
        return usuario != null && jugador2 != null && usuario.getId().equals(jugador2.getId());
    }
}
