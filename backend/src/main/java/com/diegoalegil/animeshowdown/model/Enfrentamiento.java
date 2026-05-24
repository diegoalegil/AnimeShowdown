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
        @Index(name = "idx_enf_personaje2", columnList = "personaje2_id"),
        // Bracket: listar por torneo ordenado por ronda y dentro de ronda
        // por id (orden estable de inserción) lo resuelve este índice
        // compuesto sin tocar disco más allá del lookup.
        @Index(name = "idx_enf_torneo_ronda", columnList = "torneo_id,ronda")
})
public class Enfrentamiento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "torneo_id", nullable = false)
    private Torneo torneo;

    /**
     * Personaje1 del enfrentamiento. Nullable porque las rondas 2+ del
     * bracket se precomputan con slots vacíos y se rellenan al determinar
     * el ganador de la ronda anterior.
     */
    @ManyToOne
    @JoinColumn(name = "personaje1_id")
    private Personaje personaje1;

    @ManyToOne
    @JoinColumn(name = "personaje2_id")
    private Personaje personaje2;

    @ManyToOne
    @JoinColumn(name = "ganador_id", nullable = true)
    private Personaje ganador;

    /**
     * Ronda del bracket: 1 = octavos (o 1ª ronda del tamaño que tenga),
     * 2 = cuartos, 3 = semis, 4 = final, etc. Default 1 para retro-
     * compatibilidad con torneos creados antes del bracket precomputado.
     */
    @Column(nullable = false, columnDefinition = "INTEGER DEFAULT 1")
    private Integer ronda = 1;

    @Column(nullable = false)
    private LocalDateTime fechaCreacion;

    public Enfrentamiento() {
    }

    public Enfrentamiento(Torneo torneo, Personaje personaje1, Personaje personaje2) {
        this(torneo, personaje1, personaje2, 1);
    }

    public Enfrentamiento(Torneo torneo, Personaje personaje1, Personaje personaje2, int ronda) {
        this.torneo = torneo;
        this.personaje1 = personaje1;
        this.personaje2 = personaje2;
        this.ronda = ronda;
        this.fechaCreacion = LocalDateTime.now();
    }

    @PrePersist
    protected void onCreate() {
        if (this.fechaCreacion == null) {
            this.fechaCreacion = LocalDateTime.now();
        }
        if (this.ronda == null) {
            this.ronda = 1;
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

    public Integer getRonda() {
        return ronda;
    }

    public void setRonda(Integer ronda) {
        this.ronda = ronda;
    }

    public LocalDateTime getFechaCreacion() {
        return fechaCreacion;
    }

    public void setFechaCreacion(LocalDateTime fechaCreacion) {
        this.fechaCreacion = fechaCreacion;
    }
}
