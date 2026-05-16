package com.diegoalegil.animeshowdown.model;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Suscripción a newsletter (Plan v2 §4.8). Double opt-in:
 *   - {@code confirmado=false} hasta que el user clica el link del email.
 *   - {@code token_confirm} es one-shot: tras confirmar pasa a null.
 *   - {@code token_unsubscribe} se mantiene activo mientras la sub esté
 *     viva — sirve para el link del footer de cada envío real.
 */
@Entity
@Table(name = "newsletter_subs")
public class NewsletterSub {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(nullable = false)
    private Boolean confirmado = false;

    @Column(name = "token_confirm", length = 64)
    private String tokenConfirm;

    @Column(name = "token_unsubscribe", nullable = false, length = 64)
    private String tokenUnsubscribe;

    @Column(name = "confirm_expira_en")
    private LocalDateTime confirmExpiraEn;

    @Column(name = "fecha_alta", nullable = false)
    private LocalDateTime fechaAlta;

    @Column(name = "fecha_confirmacion")
    private LocalDateTime fechaConfirmacion;

    public NewsletterSub() {}

    public NewsletterSub(String email) {
        this.email = email;
        this.confirmado = false;
        this.tokenConfirm = UUID.randomUUID().toString();
        this.tokenUnsubscribe = UUID.randomUUID().toString();
        this.confirmExpiraEn = LocalDateTime.now().plusHours(48);
        this.fechaAlta = LocalDateTime.now();
    }

    /** Refresca el token de confirmación (al re-suscribir un email ya existente sin confirmar). */
    public void refrescarTokenConfirm() {
        this.tokenConfirm = UUID.randomUUID().toString();
        this.confirmExpiraEn = LocalDateTime.now().plusHours(48);
    }

    public void marcarConfirmado() {
        this.confirmado = true;
        this.tokenConfirm = null;
        this.confirmExpiraEn = null;
        this.fechaConfirmacion = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public boolean isConfirmado() { return Boolean.TRUE.equals(confirmado); }
    public String getTokenConfirm() { return tokenConfirm; }
    public String getTokenUnsubscribe() { return tokenUnsubscribe; }
    public LocalDateTime getConfirmExpiraEn() { return confirmExpiraEn; }
    public LocalDateTime getFechaAlta() { return fechaAlta; }
    public LocalDateTime getFechaConfirmacion() { return fechaConfirmacion; }
}
