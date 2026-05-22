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

@Entity
@Table(name = "duelos_live", indexes = {
        @Index(name = "idx_duelos_live_estado", columnList = "estado"),
        @Index(name = "idx_duelos_live_jugador1", columnList = "jugador1_id"),
        @Index(name = "idx_duelos_live_jugador2", columnList = "jugador2_id"),
        @Index(name = "idx_duelos_live_creado", columnList = "creado_en"),
        @Index(name = "idx_duelos_live_finished", columnList = "finished_en")
})
public class DueloLive {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DueloLiveEstado estado = DueloLiveEstado.WAITING;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "jugador1_id", nullable = false)
    private Usuario jugador1;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "jugador2_id")
    private Usuario jugador2;

    @Column(name = "jugador2_bot", nullable = false)
    private boolean jugador2Bot = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ganador_id")
    private Usuario ganador;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "abandonador_id")
    private Usuario abandonador;

    @Column(name = "ronda_actual", nullable = false)
    private int rondaActual = 0;

    @Column(name = "score_jugador1", nullable = false)
    private int scoreJugador1 = 0;

    @Column(name = "score_jugador2", nullable = false)
    private int scoreJugador2 = 0;

    @Column(name = "rondas_validas", nullable = false)
    private int rondasValidas = 0;

    @Column(name = "jugador1_elo_before", nullable = false)
    private int jugador1EloBefore = 1000;

    @Column(name = "jugador2_elo_before", nullable = false)
    private int jugador2EloBefore = 1000;

    @Column(name = "jugador1_elo_after")
    private Integer jugador1EloAfter;

    @Column(name = "jugador2_elo_after")
    private Integer jugador2EloAfter;

    @Column(name = "jugador1_ip", length = 64)
    private String jugador1Ip;

    @Column(name = "jugador2_ip", length = 64)
    private String jugador2Ip;

    @Column(name = "creado_en", nullable = false)
    private LocalDateTime creadoEn;

    @Column(name = "matched_en")
    private LocalDateTime matchedEn;

    @Column(name = "started_en")
    private LocalDateTime startedEn;

    @Column(name = "finished_en")
    private LocalDateTime finishedEn;

    @Column(name = "abandoned_en")
    private LocalDateTime abandonedEn;

    @Column(name = "last_seen_jugador1")
    private LocalDateTime lastSeenJugador1;

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

    public Long getId() { return id; }
    public DueloLiveEstado getEstado() { return estado; }
    public void setEstado(DueloLiveEstado estado) { this.estado = estado; }
    public Usuario getJugador1() { return jugador1; }
    public void setJugador1(Usuario jugador1) { this.jugador1 = jugador1; }
    public Usuario getJugador2() { return jugador2; }
    public void setJugador2(Usuario jugador2) { this.jugador2 = jugador2; }
    public boolean isJugador2Bot() { return jugador2Bot; }
    public void setJugador2Bot(boolean jugador2Bot) { this.jugador2Bot = jugador2Bot; }
    public Usuario getGanador() { return ganador; }
    public void setGanador(Usuario ganador) { this.ganador = ganador; }
    public Usuario getAbandonador() { return abandonador; }
    public void setAbandonador(Usuario abandonador) { this.abandonador = abandonador; }
    public int getRondaActual() { return rondaActual; }
    public void setRondaActual(int rondaActual) { this.rondaActual = rondaActual; }
    public int getScoreJugador1() { return scoreJugador1; }
    public void setScoreJugador1(int scoreJugador1) { this.scoreJugador1 = scoreJugador1; }
    public int getScoreJugador2() { return scoreJugador2; }
    public void setScoreJugador2(int scoreJugador2) { this.scoreJugador2 = scoreJugador2; }
    public int getRondasValidas() { return rondasValidas; }
    public void setRondasValidas(int rondasValidas) { this.rondasValidas = rondasValidas; }
    public int getJugador1EloBefore() { return jugador1EloBefore; }
    public void setJugador1EloBefore(int jugador1EloBefore) { this.jugador1EloBefore = jugador1EloBefore; }
    public int getJugador2EloBefore() { return jugador2EloBefore; }
    public void setJugador2EloBefore(int jugador2EloBefore) { this.jugador2EloBefore = jugador2EloBefore; }
    public Integer getJugador1EloAfter() { return jugador1EloAfter; }
    public void setJugador1EloAfter(Integer jugador1EloAfter) { this.jugador1EloAfter = jugador1EloAfter; }
    public Integer getJugador2EloAfter() { return jugador2EloAfter; }
    public void setJugador2EloAfter(Integer jugador2EloAfter) { this.jugador2EloAfter = jugador2EloAfter; }
    public String getJugador1Ip() { return jugador1Ip; }
    public void setJugador1Ip(String jugador1Ip) { this.jugador1Ip = jugador1Ip; }
    public String getJugador2Ip() { return jugador2Ip; }
    public void setJugador2Ip(String jugador2Ip) { this.jugador2Ip = jugador2Ip; }
    public LocalDateTime getCreadoEn() { return creadoEn; }
    public void setCreadoEn(LocalDateTime creadoEn) { this.creadoEn = creadoEn; }
    public LocalDateTime getMatchedEn() { return matchedEn; }
    public void setMatchedEn(LocalDateTime matchedEn) { this.matchedEn = matchedEn; }
    public LocalDateTime getStartedEn() { return startedEn; }
    public void setStartedEn(LocalDateTime startedEn) { this.startedEn = startedEn; }
    public LocalDateTime getFinishedEn() { return finishedEn; }
    public void setFinishedEn(LocalDateTime finishedEn) { this.finishedEn = finishedEn; }
    public LocalDateTime getAbandonedEn() { return abandonedEn; }
    public void setAbandonedEn(LocalDateTime abandonedEn) { this.abandonedEn = abandonedEn; }
    public LocalDateTime getLastSeenJugador1() { return lastSeenJugador1; }
    public void setLastSeenJugador1(LocalDateTime lastSeenJugador1) { this.lastSeenJugador1 = lastSeenJugador1; }
    public LocalDateTime getLastSeenJugador2() { return lastSeenJugador2; }
    public void setLastSeenJugador2(LocalDateTime lastSeenJugador2) { this.lastSeenJugador2 = lastSeenJugador2; }
}
