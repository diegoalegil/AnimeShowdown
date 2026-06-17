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
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;

/**
 * Posesión de un marco de avatar desbloqueado por un usuario (cosmético
 * coin-sink, V72). Una fila por (usuario, marcoId); la UNIQUE garantiza que la
 * compra es idempotente y serializa compras concurrentes del mismo marco.
 *
 * <p>El catálogo de marcos (precios, estilo) vive en código
 * ({@code MarcoCatalogo}); aquí solo guardamos QUÉ marcos ha comprado cada
 * usuario. El marco equipado se guarda aparte en {@code usuarios.marco_avatar}.
 */
@Entity
@Table(name = "usuario_marco",
        uniqueConstraints = @UniqueConstraint(name = "uk_usuario_marco_unico",
                columnNames = {"usuario_id", "marco_id"}),
        indexes = @Index(name = "idx_usuario_marco_usuario", columnList = "usuario_id"))
@Getter
public class UsuarioMarco {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "marco_id", nullable = false, length = 64)
    private String marcoId;

    @Column(name = "adquirido_en", nullable = false)
    private LocalDateTime adquiridoEn;

    protected UsuarioMarco() {
    }

    public UsuarioMarco(Usuario usuario, String marcoId) {
        this.usuario = usuario;
        this.marcoId = marcoId;
    }

    @PrePersist
    void onCreate() {
        if (adquiridoEn == null) {
            adquiridoEn = LocalDateTime.now();
        }
    }
}
