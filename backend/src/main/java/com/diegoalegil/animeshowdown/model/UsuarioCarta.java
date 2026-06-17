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
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * Una carta poseída por un usuario. Server-authoritative: el cliente nunca
 * decide qué tiene. Los duplicados incrementan {@link #cantidad} en lugar de
 * crear filas nuevas (UNIQUE usuario+carta).
 */
@Entity
@Getter
@Setter
@Table(name = "usuario_carta", indexes = {
        @Index(name = "idx_usuario_carta_usuario", columnList = "usuario_id")
})
public class UsuarioCarta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "carta_id", nullable = false)
    private Carta carta;

    @Column(nullable = false)
    private int cantidad = 1;

    @Column(name = "obtenida_en", nullable = false)
    private LocalDateTime obtenidaEn;

    @Column(name = "actualizada_en", nullable = false)
    private LocalDateTime actualizadaEn;

    /**
     * Si esta carta es la "destacada" del usuario en su perfil público. Solo
     * una por usuario a la vez (lo garantiza el service: set-once que limpia la
     * anterior en la misma transacción).
     */
    @Column(nullable = false)
    private boolean destacada = false;

    public UsuarioCarta() {
    }

    public UsuarioCarta(Usuario usuario, Carta carta) {
        this.usuario = usuario;
        this.carta = carta;
        this.cantidad = 1;
    }

    @PrePersist
    void onCreate() {
        LocalDateTime ahora = LocalDateTime.now();
        if (obtenidaEn == null) {
            obtenidaEn = ahora;
        }
        actualizadaEn = ahora;
        if (cantidad < 1) {
            cantidad = 1;
        }
    }

    @PreUpdate
    void onUpdate() {
        actualizadaEn = LocalDateTime.now();
    }

    /** Suma un duplicado a la colección. */
    public void incrementar() {
        this.cantidad += 1;
    }
}
