package com.diegoalegil.animeshowdown.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "personaje_voto_score", indexes = {
        @Index(name = "idx_personaje_voto_score_score", columnList = "votos_score DESC, personaje_id ASC")
})
public class PersonajeVotoScore {

    @Id
    @Column(name = "personaje_id")
    private Long personajeId;

    @Column(name = "votos_score", nullable = false)
    private double votosScore = 0.0d;

    @Column(name = "actualizado_en", nullable = false)
    private LocalDateTime actualizadoEn;

    public PersonajeVotoScore() {
    }

    public PersonajeVotoScore(Long personajeId) {
        this.personajeId = personajeId;
    }

    @PrePersist
    @PreUpdate
    void touch() {
        if (actualizadoEn == null) {
            actualizadoEn = LocalDateTime.now();
        }
    }

    public void incrementar(double delta) {
        this.votosScore = Math.max(0.0d, this.votosScore + delta);
        this.actualizadoEn = LocalDateTime.now();
    }

    public Long getPersonajeId() {
        return personajeId;
    }

    public void setPersonajeId(Long personajeId) {
        this.personajeId = personajeId;
    }

    public double getVotosScore() {
        return votosScore;
    }

    public void setVotosScore(double votosScore) {
        this.votosScore = Math.max(0.0d, votosScore);
    }

    public LocalDateTime getActualizadoEn() {
        return actualizadoEn;
    }

    public void setActualizadoEn(LocalDateTime actualizadoEn) {
        this.actualizadoEn = actualizadoEn;
    }
}
