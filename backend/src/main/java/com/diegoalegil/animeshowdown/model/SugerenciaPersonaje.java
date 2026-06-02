package com.diegoalegil.animeshowdown.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Enumerated;
import jakarta.persistence.EnumType;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Sugerencia de personaje propuesta por un usuario, en cola de moderación.
 *
 * <p>La identidad ({@link #identidad}) es obligatoria por REGLA #7 — el usuario
 * debe aportar algo concreto (kanji, emblema o referencia real), no genérico.
 */
@Entity
@Table(name = "sugerencias_personaje", indexes = {
        @Index(name = "idx_sugerencia_estado_creado", columnList = "estado, creado_en"),
        @Index(name = "idx_sugerencia_usuario_creado", columnList = "usuario_id, creado_en")
})
public class SugerenciaPersonaje {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(nullable = false, length = 120)
    private String nombre;

    @Column(nullable = false, length = 120)
    private String anime;

    @Column(columnDefinition = "TEXT")
    private String motivo;

    /** REGLA #7: identidad real (kanji/emblema/referencia). Obligatoria. */
    @Column(nullable = false, length = 300)
    private String identidad;

    @Column(name = "url_referencia", length = 500)
    private String urlReferencia;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SugerenciaEstado estado = SugerenciaEstado.PENDIENTE;

    @Column(name = "motivo_rechazo", length = 500)
    private String motivoRechazo;

    @Column(name = "creado_en", nullable = false)
    private LocalDateTime creadoEn;

    @Column(name = "revisado_en")
    private LocalDateTime revisadoEn;

    public SugerenciaPersonaje() {
    }

    public Long getId() { return id; }
    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getAnime() { return anime; }
    public void setAnime(String anime) { this.anime = anime; }
    public String getMotivo() { return motivo; }
    public void setMotivo(String motivo) { this.motivo = motivo; }
    public String getIdentidad() { return identidad; }
    public void setIdentidad(String identidad) { this.identidad = identidad; }
    public String getUrlReferencia() { return urlReferencia; }
    public void setUrlReferencia(String urlReferencia) { this.urlReferencia = urlReferencia; }
    public SugerenciaEstado getEstado() { return estado; }
    public void setEstado(SugerenciaEstado estado) { this.estado = estado; }
    public String getMotivoRechazo() { return motivoRechazo; }
    public void setMotivoRechazo(String motivoRechazo) { this.motivoRechazo = motivoRechazo; }
    public LocalDateTime getCreadoEn() { return creadoEn; }
    public void setCreadoEn(LocalDateTime creadoEn) { this.creadoEn = creadoEn; }
    public LocalDateTime getRevisadoEn() { return revisadoEn; }
    public void setRevisadoEn(LocalDateTime revisadoEn) { this.revisadoEn = revisadoEn; }
}
