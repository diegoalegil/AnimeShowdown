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

import lombok.Getter;

/**
 * Reaction emoji de un usuario sobre un target.
 *
 * <p>UNIQUE(usuario_id, target_type, target_id) garantiza 1 reaction por par.
 * Para "cambiar" reaction el {@code ReaccionService} hace UPDATE; para
 * "quitar" hace DELETE. Nunca hay dos filas para el mismo par.
 */
@Getter
@Entity
@Table(
    name = "reacciones",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_reacciones_par",
        columnNames = {"usuario_id", "target_type", "target_id"}
    ),
    indexes = {
        @Index(name = "idx_reacciones_target", columnList = "target_type, target_id"),
        @Index(name = "idx_reacciones_usuario", columnList = "usuario_id"),
    }
)
public class Reaccion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReaccionTipo tipo;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 20)
    private ReaccionTargetType targetType;

    @Column(name = "target_id", nullable = false)
    private Long targetId;

    @Column(nullable = false)
    private LocalDateTime fecha;

    public Reaccion() {}

    public Reaccion(Usuario usuario, ReaccionTipo tipo, ReaccionTargetType targetType, Long targetId) {
        this.usuario = usuario;
        this.tipo = tipo;
        this.targetType = targetType;
        this.targetId = targetId;
        this.fecha = LocalDateTime.now();
    }

    public void setTipo(ReaccionTipo tipo) { this.tipo = tipo; this.fecha = LocalDateTime.now(); }
}
