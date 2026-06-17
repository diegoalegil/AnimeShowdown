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
 * Token de verificación de email tras signup.
 *
 * Flujo:
 *   1. Tras /registro, se crea una fila con token UUID + expira_en = now+24h.
 *   2. Se envía un email al usuario con link /verify?token={token}.
 *   3. Al pinchar el link, el frontend llama GET /api/auth/verify?token=...
 *      que marca el token como usado y pasa el usuario a EstadoVerificacion.ACTIVO.
 *
 * Si el token expira sin usarse, el usuario puede pedir reenvio desde el
 * banner persistente del frontend → POST /api/auth/resend-verification.
 *
 * Por qué guardar el token en plano (no hash como refresh tokens):
 *   - Aquí el token es de uso único y vida corta (24h).
 *   - No hay valor en proteger su filtración a posteriori: una vez usado,
 *     queda invalidado por el `usado_en`.
 *   - El refresh token sí se hashea porque es de larga vida (30d) y muchos
 *     activos a la vez.
 */
@Entity
@Getter
@Setter
@Table(name = "email_verifications", indexes = {
        @Index(name = "idx_email_verif_usuario", columnList = "usuario_id"),
        @Index(name = "idx_email_verif_expira", columnList = "expira_en")
})
public class EmailVerification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(nullable = false, unique = true, length = 64)
    private String token;

    @Column(name = "creado_en", nullable = false)
    private LocalDateTime creadoEn;

    @Column(name = "expira_en", nullable = false)
    private LocalDateTime expiraEn;

    /** Null = token activo; con fecha = ya consumido. */
    @Column(name = "usado_en")
    private LocalDateTime usadoEn;

    public EmailVerification() {
    }

    public EmailVerification(Usuario usuario, String token, LocalDateTime expiraEn) {
        this.usuario = usuario;
        this.token = token;
        this.creadoEn = LocalDateTime.now();
        this.expiraEn = expiraEn;
    }

    public boolean estaActivo() {
        return usadoEn == null && expiraEn.isAfter(LocalDateTime.now());
    }

    public void marcarComoUsado() {
        this.usadoEn = LocalDateTime.now();
    }
}
