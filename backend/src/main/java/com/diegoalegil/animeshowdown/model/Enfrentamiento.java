package com.diegoalegil.animeshowdown.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "enfrentamientos", indexes = {
        // Queries hot path: findByTorneo (listado del bracket), las cascadas
        // del DataSeeder por personaje1/2, y los join al cerrar torneos.
        @Index(name = "idx_enf_torneo", columnList = "torneo_id"),
        @Index(name = "idx_enf_personaje1", columnList = "personaje1_id"),
        @Index(name = "idx_enf_personaje2", columnList = "personaje2_id")
})
public class Enfrentamiento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "torneo_id", nullable = false)
    private Torneo torneo;

    @ManyToOne
    @JoinColumn(name = "personaje1_id", nullable = false)
    private Personaje personaje1;

    @ManyToOne
    @JoinColumn(name = "personaje2_id", nullable = false)
    private Personaje personaje2;

    @ManyToOne
    @JoinColumn(name = "ganador_id", nullable = true)
    private Personaje ganador;

    @Column(nullable = false)
    private LocalDateTime fechaCreacion;

    public Enfrentamiento() {
    }

    public Enfrentamiento(Torneo torneo, Personaje personaje1, Personaje personaje2) {
        this.torneo = torneo;
        this.personaje1 = personaje1;
        this.personaje2 = personaje2;
        this.fechaCreacion = LocalDateTime.now();
    }

    @PrePersist
    protected void onCreate() {
        if (this.fechaCreacion == null) {
            this.fechaCreacion = LocalDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Torneo getTorneo() {
        return torneo;
    }

    public void setTorneo(Torneo torneo) {
        this.torneo = torneo;
    }

    public Personaje getPersonaje1() {
        return personaje1;
    }

    public void setPersonaje1(Personaje personaje1) {
        this.personaje1 = personaje1;
    }

    public Personaje getPersonaje2() {
        return personaje2;
    }

    public void setPersonaje2(Personaje personaje2) {
        this.personaje2 = personaje2;
    }

    public Personaje getGanador() {
        return ganador;
    }

    public void setGanador(Personaje ganador) {
        this.ganador = ganador;
    }

    public LocalDateTime getFechaCreacion() {
        return fechaCreacion;
    }

    public void setFechaCreacion(LocalDateTime fechaCreacion) {
        this.fechaCreacion = fechaCreacion;
    }
}
