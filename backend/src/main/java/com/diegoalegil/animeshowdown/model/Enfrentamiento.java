package com.diegoalegil.animeshowdown.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "enfrentamientos")
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
}
