package com.diegoalegil.animeshowdown.model;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;

/**
 * Suscripción a newsletter. Double opt-in:
 *   - {@code confirmado=false} hasta que el user clica el link del email.
 *   - {@code token_confirm} es one-shot: tras confirmar pasa a null.
 *   - {@code token_unsubscribe} se mantiene activo mientras la sub esté
 *     viva — sirve para el link del footer de cada envío real.
 */
@Entity
@Table(name = "newsletter_subs")
public class NewsletterSub {

    @Getter
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Getter
    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(nullable = false)
    private Boolean confirmado = false;

    @Getter
    @Column(name = "token_confirm", length = 64)
    private String tokenConfirm;

    @Getter
    @Column(name = "token_unsubscribe", nullable = false, length = 64)
    private String tokenUnsubscribe;

    @Getter
    @Column(name = "confirm_expira_en")
    private LocalDateTime confirmExpiraEn;

    @Getter
    @Column(name = "fecha_alta", nullable = false)
    private LocalDateTime fechaAlta;

    @Getter
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

    public boolean isConfirmado() { return Boolean.TRUE.equals(confirmado); }
}
