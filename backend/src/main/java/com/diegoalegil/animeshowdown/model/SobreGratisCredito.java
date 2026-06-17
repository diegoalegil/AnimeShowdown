package com.diegoalegil.animeshowdown.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

/**
 * Crédito de un sobre gratis pendiente de abrir. El "sobre temático" de las
 * recompensas de evento no se abre al instante: se concede este crédito y el
 * usuario lo abre cuando vuelve a la colección (gancho de reenganche).
 *
 * <p>{@code referencia} es única → idempotencia del otorgamiento.
 * {@code consumidoEn == null} ⇒ pendiente.
 */
@Entity
@Table(name = "sobre_gratis_credito",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_sobre_gratis_referencia",
                columnNames = "referencia"))
@Getter
public class SobreGratisCredito {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "usuario_id", nullable = false)
    private Long usuarioId;

    @Column(nullable = false, length = 80)
    private String origen;

    @Column(nullable = false, length = 160)
    private String referencia;

    @Column(length = 120)
    private String etiqueta;

    @Setter
    @Column(name = "consumido_en")
    private LocalDateTime consumidoEn;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    protected SobreGratisCredito() {
    }

    public SobreGratisCredito(Long usuarioId, String origen, String referencia, String etiqueta) {
        this.usuarioId = usuarioId;
        this.origen = origen;
        this.referencia = referencia;
        this.etiqueta = etiqueta;
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
