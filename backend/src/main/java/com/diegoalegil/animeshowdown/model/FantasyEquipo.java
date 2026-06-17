package com.diegoalegil.animeshowdown.model;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(name = "fantasy_equipo",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_fantasy_equipo_usuario_semana",
                columnNames = {"usuario_id", "semana_iso"}),
        indexes = @Index(
                name = "idx_fantasy_equipo_semana_puntos",
                columnList = "semana_iso,puntos"))
public class FantasyEquipo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "semana_iso", nullable = false, length = 8)
    private String semanaIso;

    @Column(name = "locked_at")
    private LocalDateTime lockedAt;

    @Column(nullable = false)
    private Integer puntos = 0;

    @Column(name = "puntos_calculados_at")
    private LocalDateTime puntosCalculadosAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "equipo", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<FantasyEquipoItem> items = new ArrayList<>();

    public FantasyEquipo() {
    }

    public FantasyEquipo(Usuario usuario, String semanaIso) {
        this.usuario = usuario;
        this.semanaIso = semanaIso;
    }

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public boolean isLocked() {
        return lockedAt != null;
    }

    public void reemplazarItems(List<FantasyEquipoItem> nuevosItems) {
        items.clear();
        for (FantasyEquipoItem item : nuevosItems) {
            item.setEquipo(this);
            items.add(item);
        }
    }
}
