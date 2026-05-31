package com.diegoalegil.animeshowdown.model;

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

@Entity
@Table(name = "fantasy_equipo_item",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_fantasy_item_equipo_personaje",
                columnNames = {"fantasy_equipo_id", "personaje_id"}),
        indexes = {
                @Index(name = "idx_fantasy_item_equipo", columnList = "fantasy_equipo_id"),
                @Index(name = "idx_fantasy_item_personaje", columnList = "personaje_id")
        })
public class FantasyEquipoItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "fantasy_equipo_id", nullable = false)
    private FantasyEquipo equipo;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "personaje_id", nullable = false)
    private Personaje personaje;

    @Column(nullable = false)
    private Integer coste;

    public FantasyEquipoItem() {
    }

    public FantasyEquipoItem(Personaje personaje, Integer coste) {
        this.personaje = personaje;
        this.coste = coste;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public FantasyEquipo getEquipo() { return equipo; }
    public void setEquipo(FantasyEquipo equipo) { this.equipo = equipo; }
    public Personaje getPersonaje() { return personaje; }
    public void setPersonaje(Personaje personaje) { this.personaje = personaje; }
    public Integer getCoste() { return coste; }
    public void setCoste(Integer coste) { this.coste = coste; }
}
