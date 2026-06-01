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
@Table(name = "carta_trade", indexes = {
        @Index(name = "idx_carta_trade_solicitante", columnList = "solicitante_id, creado_en"),
        @Index(name = "idx_carta_trade_destinatario", columnList = "destinatario_id, creado_en"),
        @Index(name = "idx_carta_trade_estado", columnList = "estado, creado_en")
})
public class CartaTrade {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "solicitante_id", nullable = false)
    private Usuario solicitante;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "destinatario_id", nullable = false)
    private Usuario destinatario;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "carta_ofrecida_id", nullable = false)
    private Carta cartaOfrecida;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "carta_solicitada_id", nullable = false)
    private Carta cartaSolicitada;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private CartaTradeEstado estado = CartaTradeEstado.PENDING;

    @Column(name = "idempotency_key", length = 96)
    private String idempotencyKey;

    @Column(name = "creado_en", nullable = false)
    private LocalDateTime creadoEn;

    @Column(name = "actualizado_en", nullable = false)
    private LocalDateTime actualizadoEn;

    @Column(name = "respondido_en")
    private LocalDateTime respondidoEn;

    public CartaTrade() {
    }

    public CartaTrade(Usuario solicitante, Usuario destinatario, Carta cartaOfrecida, Carta cartaSolicitada) {
        this.solicitante = solicitante;
        this.destinatario = destinatario;
        this.cartaOfrecida = cartaOfrecida;
        this.cartaSolicitada = cartaSolicitada;
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
    public Usuario getSolicitante() { return solicitante; }
    public void setSolicitante(Usuario solicitante) { this.solicitante = solicitante; }
    public Usuario getDestinatario() { return destinatario; }
    public void setDestinatario(Usuario destinatario) { this.destinatario = destinatario; }
    public Carta getCartaOfrecida() { return cartaOfrecida; }
    public void setCartaOfrecida(Carta cartaOfrecida) { this.cartaOfrecida = cartaOfrecida; }
    public Carta getCartaSolicitada() { return cartaSolicitada; }
    public void setCartaSolicitada(Carta cartaSolicitada) { this.cartaSolicitada = cartaSolicitada; }
    public CartaTradeEstado getEstado() { return estado; }
    public void setEstado(CartaTradeEstado estado) { this.estado = estado; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
    public LocalDateTime getCreadoEn() { return creadoEn; }
    public void setCreadoEn(LocalDateTime creadoEn) { this.creadoEn = creadoEn; }
    public LocalDateTime getActualizadoEn() { return actualizadoEn; }
    public void setActualizadoEn(LocalDateTime actualizadoEn) { this.actualizadoEn = actualizadoEn; }
    public LocalDateTime getRespondidoEn() { return respondidoEn; }
    public void setRespondidoEn(LocalDateTime respondidoEn) { this.respondidoEn = respondidoEn; }
}
