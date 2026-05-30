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
import jakarta.persistence.Table;

/**
 * Movimiento de moneda — el ledger es la fuente de verdad de cada cambio de
 * saldo. {@code delta} positivo = drop al jugar; negativo = gasto al abrir un
 * sobre. {@code saldoResultante} congela el saldo tras aplicar el movimiento
 * (auditoría reproducible).
 *
 * <p>El UNIQUE(usuario, motivo, referencia) garantiza idempotencia: un mismo
 * hito de drop o compra no se aplica dos veces aunque el listener se reintente.
 */
@Entity
@Table(name = "monedero_movimiento", indexes = {
        @Index(name = "idx_mon_mov_usuario_fecha", columnList = "usuario_id, creado_en")
})
public class MonederoMovimiento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(nullable = false)
    private long delta;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private MotivoMovimiento motivo;

    @Column(nullable = false, length = 96)
    private String referencia;

    @Column(name = "saldo_resultante", nullable = false)
    private long saldoResultante;

    @Column(name = "creado_en", nullable = false)
    private LocalDateTime creadoEn;

    public MonederoMovimiento() {
    }

    public MonederoMovimiento(Usuario usuario, long delta, MotivoMovimiento motivo,
            String referencia, long saldoResultante) {
        this.usuario = usuario;
        this.delta = delta;
        this.motivo = motivo;
        this.referencia = referencia;
        this.saldoResultante = saldoResultante;
    }

    @PrePersist
    void onCreate() {
        if (creadoEn == null) {
            creadoEn = LocalDateTime.now();
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }
    public long getDelta() { return delta; }
    public void setDelta(long delta) { this.delta = delta; }
    public MotivoMovimiento getMotivo() { return motivo; }
    public void setMotivo(MotivoMovimiento motivo) { this.motivo = motivo; }
    public String getReferencia() { return referencia; }
    public void setReferencia(String referencia) { this.referencia = referencia; }
    public long getSaldoResultante() { return saldoResultante; }
    public void setSaldoResultante(long saldoResultante) { this.saldoResultante = saldoResultante; }
    public LocalDateTime getCreadoEn() { return creadoEn; }
    public void setCreadoEn(LocalDateTime creadoEn) { this.creadoEn = creadoEn; }
}
