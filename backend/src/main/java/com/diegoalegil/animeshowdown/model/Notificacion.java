package com.diegoalegil.animeshowdown.model;

import java.time.LocalDateTime;

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
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.Setter;

/**
 * Notificación in-app persistente. El usuario la ve en la
 * campanita del header. Si está conectado al WS cuando se crea, recibe push
 * en tiempo real al topic /user/queue/notificaciones; si no, la verá al
 * cargar la lista REST.
 */
@Entity
@Table(name = "notificaciones", indexes = {
        @Index(name = "idx_notif_usuario_leida_fecha", columnList = "usuario_id, leida, creado_en DESC"),
        @Index(name = "idx_notif_usuario_fecha", columnList = "usuario_id, creado_en DESC"),
        @Index(name = "uk_notif_usuario_tipo_evento", columnList = "usuario_id, tipo, evento_key", unique = true)
})
public class Notificacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Getter
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    @Getter
    @Setter
    private Usuario usuario;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    @Getter
    @Setter
    private NotificacionTipo tipo;

    @Column(nullable = false, length = 200)
    @Getter
    @Setter
    private String titulo;

    @Column(length = 500)
    @Getter
    @Setter
    private String mensaje;

    /**
     * JSON crudo con datos contextuales (ids de torneos referenciados, etc).
     * Se serializa en el service que crea la notificación; el frontend lo
     * parsea para construir links — el backend no lo interpreta.
     */
    @Column(columnDefinition = "TEXT")
    @Getter
    @Setter
    private String payload;

    @Column(name = "evento_key", length = 768)
    @Getter
    @Setter
    private String eventoKey;

    @Column(nullable = false)
    private Boolean leida = false;

    @Column(name = "creado_en", nullable = false)
    @Getter
    @Setter
    private LocalDateTime creadoEn;

    public Notificacion() {
    }

    public Notificacion(Usuario usuario, NotificacionTipo tipo, String titulo,
            String mensaje, String payload) {
        this.usuario = usuario;
        this.tipo = tipo;
        this.titulo = titulo;
        this.mensaje = mensaje;
        this.payload = payload;
        this.leida = false;
        this.creadoEn = LocalDateTime.now();
    }

    public Notificacion(Usuario usuario, NotificacionTipo tipo, String titulo,
            String mensaje, String payload, String eventoKey) {
        this(usuario, tipo, titulo, mensaje, payload);
        this.eventoKey = eventoKey;
    }

    public boolean isLeida() { return leida != null && leida; }
    public void setLeida(boolean leida) { this.leida = leida; }
}
