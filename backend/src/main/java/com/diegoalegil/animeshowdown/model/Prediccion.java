package com.diegoalegil.animeshowdown.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * Predicción de un usuario sobre quién ganará un enfrentamiento (Plan v2 §4.4).
 *
 * <p>UNIQUE(usuario_id, enfrentamiento_id) → 1 predicción por par. Para
 * cambiar la predicción mientras el match esté abierto, el service hace
 * UPDATE del campo {@code personajePredicho}. {@code acertada} es null
 * mientras el torneo no se haya finalizado; tras la finalización pasa a
 * true o false.
 */
@Entity
@Table(
    name = "predicciones",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_pred_usuario_enf",
        columnNames = {"usuario_id", "enfrentamiento_id"}
    ),
    indexes = {
        @Index(name = "idx_pred_usuario", columnList = "usuario_id"),
        @Index(name = "idx_pred_enf", columnList = "enfrentamiento_id"),
        @Index(name = "idx_pred_acertada_fecha", columnList = "acertada, fecha"),
    }
)
public class Prediccion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "enfrentamiento_id", nullable = false)
    private Enfrentamiento enfrentamiento;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "personaje_predicho_id", nullable = false)
    private Personaje personajePredicho;

    @Column(nullable = false)
    private LocalDateTime fecha;

    /** null = pendiente; true/false = ya resuelta tras finalizar el torneo. */
    @Column
    private Boolean acertada;

    public Prediccion() {}

    public Prediccion(Usuario usuario, Enfrentamiento enf, Personaje predicho) {
        this.usuario = usuario;
        this.enfrentamiento = enf;
        this.personajePredicho = predicho;
        this.fecha = LocalDateTime.now();
        this.acertada = null;
    }

    public Long getId() { return id; }
    public Usuario getUsuario() { return usuario; }
    public Enfrentamiento getEnfrentamiento() { return enfrentamiento; }
    public Personaje getPersonajePredicho() { return personajePredicho; }
    public void setPersonajePredicho(Personaje personajePredicho) {
        this.personajePredicho = personajePredicho;
        this.fecha = LocalDateTime.now();
    }
    public LocalDateTime getFecha() { return fecha; }
    public Boolean getAcertada() { return acertada; }
    public void setAcertada(Boolean acertada) { this.acertada = acertada; }

    public boolean estaResuelta() { return acertada != null; }
}
