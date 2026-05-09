package com.diegoalegil.animeshowdown.model;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;

@Entity
@Table(name = "votos", uniqueConstraints = {
        @UniqueConstraint(name = "uk_voto_personaje_usuario", columnNames = { "personaje_id", "usuario_id" }),
        @UniqueConstraint(name = "uk_voto_enfrentamiento_usuario", columnNames = { "enfrentamiento_id", "usuario_id" })
})
public class Voto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDateTime fecha;

    @ManyToOne
    @JoinColumn(name = "personaje_id", nullable = false)
    private Personaje personaje;

    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "usuario_id", nullable = true)
    private Usuario usuario;

    @ManyToOne
    @JoinColumn(name = "enfrentamiento_id", nullable = true)
    private Enfrentamiento enfrentamiento;

    public Voto() {
    }

    public Voto(Personaje personaje) {
        this.personaje = personaje;
        this.fecha = LocalDateTime.now();
    }

    public Voto(Personaje personaje, Usuario usuario) {
        this.personaje = personaje;
        this.usuario = usuario;
        this.fecha = LocalDateTime.now();
    }

    public Voto(Personaje personaje, Usuario usuario, Enfrentamiento enfrentamiento) {
        this.personaje = personaje;
        this.usuario = usuario;
        this.enfrentamiento = enfrentamiento;
        this.fecha = LocalDateTime.now();
    }

    @PrePersist
    protected void onCreate() {
        if (this.fecha == null) {
            this.fecha = LocalDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public LocalDateTime getFecha() {
        return fecha;
    }

    public void setFecha(LocalDateTime fecha) {
        this.fecha = fecha;
    }

    public Personaje getPersonaje() {
        return personaje;
    }

    public void setPersonaje(Personaje personaje) {
        this.personaje = personaje;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public void setUsuario(Usuario usuario) {
        this.usuario = usuario;
    }

    public Enfrentamiento getEnfrentamiento() {
        return enfrentamiento;
    }

    public void setEnfrentamiento(Enfrentamiento enfrentamiento) {
        this.enfrentamiento = enfrentamiento;
    }
}
