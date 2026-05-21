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
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "comentarios_personaje", indexes = {
        @Index(name = "idx_comentarios_personaje_estado_fecha", columnList = "personaje_slug, estado, creado_en"),
        @Index(name = "idx_comentarios_autor_fecha", columnList = "autor_id, creado_en"),
        @Index(name = "idx_comentarios_estado_fecha", columnList = "estado, creado_en")
})
public class Comentario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "autor_id", nullable = false)
    private Usuario autor;

    @Column(name = "personaje_slug", nullable = false, length = 120)
    private String personajeSlug;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String contenido;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ComentarioEstado estado = ComentarioEstado.VISIBLE;

    @Column(nullable = false)
    private Integer reportes = 0;

    @Column(name = "creado_en", nullable = false)
    private LocalDateTime creadoEn;

    @Column(name = "actualizado_en", nullable = false)
    private LocalDateTime actualizadoEn;

    public Comentario() {
    }

    public Comentario(Usuario autor, String personajeSlug, String contenido, ComentarioEstado estado) {
        this.autor = autor;
        this.personajeSlug = personajeSlug;
        this.contenido = contenido;
        this.estado = estado;
    }

    @PrePersist
    void onCreate() {
        LocalDateTime ahora = LocalDateTime.now();
        if (creadoEn == null) {
            creadoEn = ahora;
        }
        actualizadoEn = ahora;
        if (estado == null) {
            estado = ComentarioEstado.VISIBLE;
        }
        if (reportes == null) {
            reportes = 0;
        }
    }

    @PreUpdate
    void onUpdate() {
        actualizadoEn = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Usuario getAutor() { return autor; }
    public String getPersonajeSlug() { return personajeSlug; }
    public String getContenido() { return contenido; }
    public ComentarioEstado getEstado() { return estado; }
    public Integer getReportes() { return reportes == null ? 0 : reportes; }
    public LocalDateTime getCreadoEn() { return creadoEn; }
    public LocalDateTime getActualizadoEn() { return actualizadoEn; }

    public void setContenido(String contenido) {
        this.contenido = contenido;
    }

    public void setEstado(ComentarioEstado estado) {
        this.estado = estado;
    }

    public void incrementarReportes() {
        this.reportes = getReportes() + 1;
    }
}
