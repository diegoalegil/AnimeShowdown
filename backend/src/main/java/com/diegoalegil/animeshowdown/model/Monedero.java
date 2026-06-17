package com.diegoalegil.animeshowdown.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * Saldo de moneda blanda de un usuario. Una fila por usuario (UNIQUE). El
 * detalle de cada cambio vive en {@link MonederoMovimiento}; aquí sólo el
 * saldo materializado para lecturas rápidas. Nunca puede ser negativo
 * (CHECK en BBDD + guardas en servicio).
 */
@Entity
@Table(name = "monedero")
@Getter
@Setter
public class Monedero {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false, unique = true)
    private Usuario usuario;

    @Column(nullable = false)
    private long saldo = 0L;

    @Column(name = "actualizado_en", nullable = false)
    private LocalDateTime actualizadoEn;

    public Monedero() {
    }

    public Monedero(Usuario usuario) {
        this.usuario = usuario;
        this.saldo = 0L;
    }

    @PrePersist
    void onCreate() {
        if (actualizadoEn == null) {
            actualizadoEn = LocalDateTime.now();
        }
    }

    @PreUpdate
    void onUpdate() {
        actualizadoEn = LocalDateTime.now();
    }
}
