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
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * Una entrada del audit log. Se inserta vía AuditLogService
 * de forma asíncrona desde controllers/services cuando ocurre un evento
 * relevante de auth o seguridad.
 *
 * `usuario` es opcional porque hay eventos pre-login (LOGIN_FAIL con
 * username inexistente, por ejemplo). Si el usuario se borra después, el
 * FK queda en NULL gracias a ON DELETE SET NULL — preservamos el historial
 * sin huérfanos colgando.
 *
 * `detalles` es String con JSON serializado. Mantengo TEXT para portabilidad
 * H2/Postgres. Si más adelante necesitamos queries por contenido (e.g.
 * "todos los logins fallidos para username='x' del último mes") migramos
 * a JSONB de Postgres con su propio V{n}__alter_audit_detalles_jsonb.sql.
 */
@Entity
@Table(name = "audit_log", indexes = {
        @Index(name = "idx_audit_ts", columnList = "ts"),
        @Index(name = "idx_audit_usuario", columnList = "usuario_id"),
        @Index(name = "idx_audit_evento", columnList = "evento")
})
@Getter
@Setter
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ts", nullable = false)
    private LocalDateTime ts;

    @ManyToOne
    @JoinColumn(name = "usuario_id")
    private Usuario usuario;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private AuditEvento evento;

    @Column(columnDefinition = "TEXT")
    private String detalles;

    @Column(name = "ip_addr", length = 64)
    private String ipAddr;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    public AuditLog() {
    }

    public AuditLog(AuditEvento evento, Usuario usuario, String detalles, String ipAddr, String userAgent) {
        this.evento = evento;
        this.usuario = usuario;
        this.detalles = detalles;
        this.ipAddr = ipAddr;
        this.userAgent = userAgent;
        this.ts = LocalDateTime.now();
    }
}
