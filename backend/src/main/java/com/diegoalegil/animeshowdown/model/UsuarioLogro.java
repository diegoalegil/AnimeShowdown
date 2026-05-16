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
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * Join entre {@link Usuario} y {@link Logro} (Plan v2 §4.2).
 *
 * <p>UNIQUE(usuario_id, logro_id) garantiza idempotencia: desbloquear dos
 * veces el mismo badge solo persiste una vez. La excepción de constraint
 * la captura {@code BadgeService.desbloquear()} como caso "ya desbloqueado".
 */
@Entity
@Table(
    name = "usuario_logros",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_usuario_logros_par",
        columnNames = {"usuario_id", "logro_id"}
    ),
    indexes = {
        @Index(name = "idx_usuario_logros_usuario", columnList = "usuario_id"),
        @Index(name = "idx_usuario_logros_logro", columnList = "logro_id"),
    }
)
public class UsuarioLogro {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "logro_id", nullable = false)
    private Logro logro;

    @Column(name = "desbloqueado_en", nullable = false)
    private LocalDateTime desbloqueadoEn;

    public UsuarioLogro() {}

    public UsuarioLogro(Usuario usuario, Logro logro) {
        this.usuario = usuario;
        this.logro = logro;
        this.desbloqueadoEn = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Usuario getUsuario() { return usuario; }
    public Logro getLogro() { return logro; }
    public LocalDateTime getDesbloqueadoEn() { return desbloqueadoEn; }
}
