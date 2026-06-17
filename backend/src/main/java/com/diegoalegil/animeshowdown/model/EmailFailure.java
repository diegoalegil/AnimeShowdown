package com.diegoalegil.animeshowdown.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * Entrada en la dead letter queue cuando un email falló tras los 3
 * reintentos de @Retryable.
 *
 * El admin lista los fallos vía GET /api/admin/email-failures y puede
 * marcarlos como reintentados (POST /api/admin/email-failures/{id}/retry)
 * cuando Resend esté sano de nuevo. El reintento queda fuera del scope
 * de esta iteración — por ahora solo listamos y observamos.
 */
@Entity
@Getter
@Setter
@Table(name = "email_failed_queue", indexes = {
        @Index(name = "idx_email_failed_ts", columnList = "ts"),
        @Index(name = "idx_email_failed_tipo", columnList = "tipo")
})
public class EmailFailure {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDateTime ts;

    @Column(nullable = false, length = 255)
    private String destinatario;

    @Column(nullable = false, length = 500)
    private String asunto;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String contenido;

    @Column(name = "error_msg", length = 1000)
    private String errorMsg;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private EmailTipo tipo;

    @Column(nullable = false)
    private boolean reintentado = false;

    public EmailFailure() {
    }

    public EmailFailure(EmailTipo tipo, String destinatario, String asunto, String contenido, String errorMsg) {
        this.tipo = tipo;
        this.destinatario = destinatario;
        this.asunto = asunto;
        this.contenido = contenido;
        this.errorMsg = errorMsg != null && errorMsg.length() > 1000
                ? errorMsg.substring(0, 1000)
                : errorMsg;
        this.ts = LocalDateTime.now();
    }
}
