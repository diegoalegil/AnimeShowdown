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

/**
 * Códigos de recuperación one-shot del 2FA TOTP.
 *
 * <p>Se generan 10 al activar 2FA y se le devuelven al usuario UNA vez
 * en plaintext (descarga/copia inmediata). En BBDD solo viven hasheados
 * con BCrypt — no son recuperables después. Al usarse uno, se marca
 * {@link #usadoEn} y queda inutilizable.
 *
 * <p>Cuando el usuario gasta los 10 o pierde el set, puede regenerar uno
 * nuevo (invalida los anteriores con DELETE WHERE usuario_id).
 */
@Entity
@Table(name = "totp_backup_codes", indexes = {
        @Index(name = "idx_backup_usuario", columnList = "usuario_id"),
        @Index(name = "idx_backup_usuario_usado", columnList = "usuario_id, usado_en")
})
public class TotpBackupCode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    /** Hash BCrypt del código (10 chars alfanuméricos en plaintext). */
    @Column(name = "codigo_hash", nullable = false)
    private String codigoHash;

    @Column(name = "creado_en", nullable = false)
    private LocalDateTime creadoEn;

    /** Null = aún no usado. Timestamp = el código ya se consumió en un login. */
    @Column(name = "usado_en")
    private LocalDateTime usadoEn;

    public TotpBackupCode() {
    }

    public TotpBackupCode(Usuario usuario, String codigoHash) {
        this.usuario = usuario;
        this.codigoHash = codigoHash;
        this.creadoEn = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public void setUsuario(Usuario usuario) {
        this.usuario = usuario;
    }

    public String getCodigoHash() {
        return codigoHash;
    }

    public void setCodigoHash(String codigoHash) {
        this.codigoHash = codigoHash;
    }

    public LocalDateTime getCreadoEn() {
        return creadoEn;
    }

    public LocalDateTime getUsadoEn() {
        return usadoEn;
    }

    public void setUsadoEn(LocalDateTime usadoEn) {
        this.usadoEn = usadoEn;
    }

    public boolean estaUsado() {
        return usadoEn != null;
    }
}
