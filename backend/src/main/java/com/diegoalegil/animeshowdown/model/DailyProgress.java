package com.diegoalegil.animeshowdown.model;

import java.time.LocalDate;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Progreso de la misión diaria de un usuario en un día concreto (server-side).
 * Una fila por (usuario, fecha) — el UNIQUE de la tabla es el ancla de
 * idempotencia. La autoridad del día es el {@code Clock} del servidor, no el
 * navegador (ver {@code DailyProgressService}).
 */
@Entity
@Table(name = "daily_progress")
public class DailyProgress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "usuario_id", nullable = false)
    private Long usuarioId;

    @Column(nullable = false)
    private LocalDate fecha;

    @Column(nullable = false)
    private int votos = 0;

    @Column(nullable = false)
    private int juegos = 0;

    @Column(name = "ranking_visto", nullable = false)
    private boolean rankingVisto = false;

    @Column(nullable = false)
    private boolean completado = false;

    @Column(name = "creado_en", nullable = false)
    private LocalDateTime creadoEn = LocalDateTime.now();

    @Column(name = "actualizado_en", nullable = false)
    private LocalDateTime actualizadoEn = LocalDateTime.now();

    protected DailyProgress() {
    }

    public DailyProgress(Long usuarioId, LocalDate fecha) {
        this.usuarioId = usuarioId;
        this.fecha = fecha;
    }

    public void tocar() {
        this.actualizadoEn = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Long getUsuarioId() {
        return usuarioId;
    }

    public LocalDate getFecha() {
        return fecha;
    }

    public int getVotos() {
        return votos;
    }

    public void setVotos(int votos) {
        this.votos = votos;
    }

    public int getJuegos() {
        return juegos;
    }

    public void setJuegos(int juegos) {
        this.juegos = juegos;
    }

    public boolean isRankingVisto() {
        return rankingVisto;
    }

    public void setRankingVisto(boolean rankingVisto) {
        this.rankingVisto = rankingVisto;
    }

    public boolean isCompletado() {
        return completado;
    }

    public void setCompletado(boolean completado) {
        this.completado = completado;
    }
}
