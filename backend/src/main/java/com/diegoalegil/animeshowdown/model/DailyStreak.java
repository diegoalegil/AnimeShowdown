package com.diegoalegil.animeshowdown.model;

import java.time.LocalDate;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Racha diaria denormalizada de un usuario (una fila por usuario, PK =
 * usuario_id). Se actualiza —con lock pesimista— justo cuando un día pasa a
 * completado. {@code ultimaFechaCompletada} permite decidir en lectura si la
 * racha sigue viva (hoy o ayer) y es la base de futuras notificaciones.
 */
@Entity
@Table(name = "daily_streak")
public class DailyStreak {

    @Id
    @Column(name = "usuario_id")
    private Long usuarioId;

    @Column(nullable = false)
    private int actual = 0;

    @Column(name = "record", nullable = false)
    private int record = 0;

    @Column(name = "ultima_fecha_completada")
    private LocalDate ultimaFechaCompletada;

    @Column(name = "actualizado_en", nullable = false)
    private LocalDateTime actualizadoEn = LocalDateTime.now();

    protected DailyStreak() {
    }

    public DailyStreak(Long usuarioId) {
        this.usuarioId = usuarioId;
    }

    public Long getUsuarioId() {
        return usuarioId;
    }

    public int getActual() {
        return actual;
    }

    public void setActual(int actual) {
        this.actual = actual;
    }

    public int getRecord() {
        return record;
    }

    public void setRecord(int record) {
        this.record = record;
    }

    public LocalDate getUltimaFechaCompletada() {
        return ultimaFechaCompletada;
    }

    public void setUltimaFechaCompletada(LocalDate ultimaFechaCompletada) {
        this.ultimaFechaCompletada = ultimaFechaCompletada;
        this.actualizadoEn = LocalDateTime.now();
    }
}
