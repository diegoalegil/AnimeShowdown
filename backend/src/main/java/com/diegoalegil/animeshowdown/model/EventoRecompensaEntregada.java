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

/**
 * Ledger del reparto de recompensas de una copa de evento. Una fila por
 * (torneo, usuario) premiado: el UNIQUE hace idempotente el finalize aunque el
 * scheduler vuelva a dispararlo. Guarda lo concedido para audit y para que el
 * frontend pueda mostrar "ganaste X en el evento Y".
 */
@Entity
@Table(name = "evento_recompensa_entregada",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_evento_recompensa_torneo_usuario",
                columnNames = {"torneo_id", "usuario_id"}))
public class EventoRecompensaEntregada {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "torneo_id", nullable = false)
    private Long torneoId;

    @Column(name = "usuario_id", nullable = false)
    private Long usuarioId;

    @Column(name = "evento_slug", nullable = false, length = 80)
    private String eventoSlug;

    @Column(nullable = false)
    private int moneda = 0;

    @Column(name = "carta_especial_id")
    private Long cartaEspecialId;

    @Column(name = "badge_codigo", length = 80)
    private String badgeCodigo;

    @Column(name = "sobre_gratis", nullable = false)
    private boolean sobreGratis = false;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    protected EventoRecompensaEntregada() {
    }

    public EventoRecompensaEntregada(Long torneoId, Long usuarioId, String eventoSlug,
            int moneda, Long cartaEspecialId, String badgeCodigo, boolean sobreGratis) {
        this.torneoId = torneoId;
        this.usuarioId = usuarioId;
        this.eventoSlug = eventoSlug;
        this.moneda = moneda;
        this.cartaEspecialId = cartaEspecialId;
        this.badgeCodigo = badgeCodigo;
        this.sobreGratis = sobreGratis;
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Long getTorneoId() {
        return torneoId;
    }

    public Long getUsuarioId() {
        return usuarioId;
    }

    public String getEventoSlug() {
        return eventoSlug;
    }

    public int getMoneda() {
        return moneda;
    }

    public Long getCartaEspecialId() {
        return cartaEspecialId;
    }

    public String getBadgeCodigo() {
        return badgeCodigo;
    }

    public boolean isSobreGratis() {
        return sobreGratis;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
