package com.diegoalegil.animeshowdown.model;

import java.time.LocalDate;
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
import lombok.Getter;

@Entity
@Getter
@Table(
    name = "madrugadores_dia",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_madrugadores_personaje_fecha",
        columnNames = {"personaje_slug", "fecha"}
    ),
    indexes = {
        @Index(name = "idx_madrugadores_usuario_fecha", columnList = "primer_user_id, fecha DESC"),
        @Index(name = "idx_madrugadores_personaje_fecha", columnList = "personaje_slug, fecha DESC")
    }
)
public class MadrugadorDia {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "personaje_slug", nullable = false)
    private String personajeSlug;

    @Column(nullable = false)
    private LocalDate fecha;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "primer_user_id", nullable = false)
    private Usuario primerUser;

    @Column(nullable = false)
    private LocalDateTime hora;

    public MadrugadorDia() {
    }

    public MadrugadorDia(String personajeSlug, LocalDate fecha, Usuario primerUser, LocalDateTime hora) {
        this.personajeSlug = personajeSlug;
        this.fecha = fecha;
        this.primerUser = primerUser;
        this.hora = hora;
    }
}
