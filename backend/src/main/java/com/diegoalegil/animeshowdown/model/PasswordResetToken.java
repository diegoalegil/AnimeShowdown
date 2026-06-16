package com.diegoalegil.animeshowdown.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(
    name = "password_reset_tokens",
    indexes = {
        @Index(name = "idx_prt_usuario_codigo", columnList = "usuario_id, codigo")
    }
)
public class PasswordResetToken {

    public static final String CODIGO_REDACTADO = "******";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "usuario_id", nullable = false)
    private Long usuarioId;

    @Column(nullable = false, length = 6)
    private String codigo;

    @Column(name = "codigo_hash", length = 100)
    private String codigoHash;

    @Column(name = "expira_en", nullable = false)
    private LocalDateTime expiraEn;

    @Column(name = "creado_en", nullable = false)
    private LocalDateTime creadoEn;

    @Column(nullable = false)
    private boolean usado = false;

    @Column(name = "usado_en")
    private LocalDateTime usadoEn;

    @Column(name = "intentos_fallidos", nullable = false, columnDefinition = "INTEGER DEFAULT 0")
    private Integer intentosFallidos = 0;

    public PasswordResetToken() {
    }

    public PasswordResetToken(Long usuarioId, String codigoHash, LocalDateTime expiraEn) {
        this.usuarioId = usuarioId;
        this.codigo = CODIGO_REDACTADO;
        this.codigoHash = codigoHash;
        this.expiraEn = expiraEn;
        this.creadoEn = LocalDateTime.now();
        this.usado = false;
    }
}
