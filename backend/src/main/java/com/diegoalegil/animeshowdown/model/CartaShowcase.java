package com.diegoalegil.animeshowdown.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

@Entity
@Table(name = "usuario_carta_showcase", indexes = {
        @Index(name = "idx_carta_showcase_usuario", columnList = "usuario_id"),
        @Index(name = "idx_carta_showcase_slot", columnList = "slot, actualizado_en")
})
public class CartaShowcase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "carta_id", nullable = false)
    private Carta carta;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private CartaShowcaseSlot slot;

    @Column(name = "creado_en", nullable = false)
    private LocalDateTime creadoEn;

    @Column(name = "actualizado_en", nullable = false)
    private LocalDateTime actualizadoEn;

    public CartaShowcase() {
    }

    public CartaShowcase(Usuario usuario, Carta carta, CartaShowcaseSlot slot) {
        this.usuario = usuario;
        this.carta = carta;
        this.slot = slot;
    }

    @PrePersist
    void onCreate() {
        LocalDateTime ahora = LocalDateTime.now();
        if (creadoEn == null) {
            creadoEn = ahora;
        }
        actualizadoEn = ahora;
    }

    @PreUpdate
    void onUpdate() {
        actualizadoEn = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }
    public Carta getCarta() { return carta; }
    public void setCarta(Carta carta) { this.carta = carta; }
    public CartaShowcaseSlot getSlot() { return slot; }
    public void setSlot(CartaShowcaseSlot slot) { this.slot = slot; }
    public LocalDateTime getCreadoEn() { return creadoEn; }
    public void setCreadoEn(LocalDateTime creadoEn) { this.creadoEn = creadoEn; }
    public LocalDateTime getActualizadoEn() { return actualizadoEn; }
    public void setActualizadoEn(LocalDateTime actualizadoEn) { this.actualizadoEn = actualizadoEn; }
}
