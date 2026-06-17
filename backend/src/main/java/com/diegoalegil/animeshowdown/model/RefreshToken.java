package com.diegoalegil.animeshowdown.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * Token de refresco persistido en BBDD. 3.
 *
 * Pareja con el access token JWT corto (15 min): cuando el JWT expira el
 * cliente llama POST /auth/refresh con la cookie httpOnly que contiene el
 * refresh token PLANO; el backend hashea SHA-256 ese plano, busca la fila
 * por token_hash, valida que no esté revocada ni expirada, la rota (revoca
 * la actual + crea nueva) y devuelve un nuevo JWT al cliente.
 *
 * Por qué guardamos el HASH y no el token plano: si la BBDD se filtra,
 * los hashes no permiten reutilizar las sesiones. SHA-256 es suficiente
 * porque los tokens son random 256 bits — no hay diccionario que probar.
 *
 * Campos `userAgent` / `ipAddr` permiten enseñarle al usuario la lista
 * de sesiones activas en /perfil → "Cerrar sesión en otros dispositivos"
 * (capa correspondiente expone esta info).
 */
@Entity
@Getter
@Setter
@Table(name = "refresh_tokens", indexes = {
        @Index(name = "idx_refresh_tokenhash", columnList = "token_hash", unique = true),
        @Index(name = "idx_refresh_usuario", columnList = "usuario_id"),
        @Index(name = "idx_refresh_expira", columnList = "expira_en")
})
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    /**
     * SHA-256 hex del token plano. UNIQUE: garantiza que dos sesiones no
     * comparten hash (probabilidad astronómica con 256 bits de entropía).
     */
    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "creado_en", nullable = false)
    private LocalDateTime creadoEn;

    @Column(name = "expira_en", nullable = false)
    private LocalDateTime expiraEn;

    /**
     * Marca cuándo se revocó la sesión. null = activa. Se setea al hacer
     * rotate (durante refresh) o logout.
     */
    @Column(name = "revocado_en")
    private LocalDateTime revocadoEn;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @Column(name = "ip_addr", length = 64)
    private String ipAddr;

    public RefreshToken() {
    }

    public RefreshToken(Usuario usuario, String tokenHash, LocalDateTime expiraEn,
            String userAgent, String ipAddr) {
        this.usuario = usuario;
        this.tokenHash = tokenHash;
        this.creadoEn = LocalDateTime.now();
        this.expiraEn = expiraEn;
        this.userAgent = userAgent;
        this.ipAddr = ipAddr;
    }

    public boolean isActivo() {
        return revocadoEn == null && expiraEn.isAfter(LocalDateTime.now());
    }

    public void revocar() {
        this.revocadoEn = LocalDateTime.now();
    }
}
