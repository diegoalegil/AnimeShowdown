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

/**
 * Notificación in-app persistente. El usuario la ve en la
 * campanita del header. Si está conectado al WS cuando se crea, recibe push
 * en tiempo real al topic /user/queue/notificaciones; si no, la verá al
 * cargar la lista REST.
 */
@Entity
@Table(name = "notificaciones", indexes = {
        @Index(name = "idx_notif_usuario_leida_fecha", columnList = "usuario_id, leida, creado_en DESC"),
        @Index(name = "idx_notif_usuario_fecha", columnList = "usuario_id, creado_en DESC")
})
public class Notificacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private NotificacionTipo tipo;

    @Column(nullable = false, length = 200)
    private String titulo;

    @Column(length = 500)
    private String mensaje;

    /**
     * JSON crudo con datos contextuales (ids de torneos referenciados, etc).
     * Se serializa en el service que crea la notificación; el frontend lo
     * parsea para construir links — el backend no lo interpreta.
     */
    @Column(columnDefinition = "TEXT")
    private String payload;

    @Column(nullable = false)
    private Boolean leida = false;

    @Column(name = "creado_en", nullable = false)
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

    public Long getId() { return id; }
    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }
    public NotificacionTipo getTipo() { return tipo; }
    public void setTipo(NotificacionTipo tipo) { this.tipo = tipo; }
    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }
    public String getMensaje() { return mensaje; }
    public void setMensaje(String mensaje) { this.mensaje = mensaje; }
    public String getPayload() { return payload; }
    public void setPayload(String payload) { this.payload = payload; }
    public boolean isLeida() { return leida != null && leida; }
    public void setLeida(boolean leida) { this.leida = leida; }
    public LocalDateTime getCreadoEn() { return creadoEn; }
    public void setCreadoEn(LocalDateTime creadoEn) { this.creadoEn = creadoEn; }
}
