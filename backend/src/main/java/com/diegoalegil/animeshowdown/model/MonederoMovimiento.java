package com.diegoalegil.animeshowdown.model;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

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
import lombok.Getter;
import lombok.Setter;

/**
 * Movimiento de moneda — el ledger es la fuente de verdad de cada cambio de
 * saldo. {@code delta} positivo = drop al jugar; negativo = gasto al abrir un
 * sobre. {@code saldoResultante} congela el saldo tras aplicar el movimiento
 * (trazabilidad reproducible).
 *
 * <p>El UNIQUE(usuario, motivo, referencia) garantiza idempotencia: un mismo
 * hito de drop o compra no se aplica dos veces aunque el listener se reintente.
 */
@Entity
@Getter
@Setter
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
            // UTC explícito: el tope diario anti-faucet calcula su ventana en UTC,
            // así que sellar en la zona de la JVM desincronizaría el borde de
            // medianoche si TZ != UTC. Independiza el sello de la zona del proceso.
            creadoEn = LocalDateTime.now(ZoneOffset.UTC);
        }
    }

}
