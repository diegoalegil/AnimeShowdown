package com.diegoalegil.animeshowdown.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "eventos_tematicos")
public class EventoTematico {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 80)
    private String slug;

    @Column(nullable = false, length = 120)
    private String titulo;

    @Column(name = "descripcion_corta", nullable = false, length = 500)
    private String descripcionCorta;

    @Enumerated(EnumType.STRING)
    @Column(name = "filtro_kind", nullable = false, length = 20)
    private EventoFiltroKind filtroKind;

    @Column(name = "filtro_valor", nullable = false, columnDefinition = "TEXT")
    private String filtroValor;

    @Column(nullable = false)
    private LocalDateTime inicio;

    @Column(nullable = false)
    private LocalDateTime fin;

    @Column(nullable = false, length = 20)
    private String color = "amber";

    @Column(nullable = false, length = 16)
    private String emoji = "*";

    @Column(nullable = false)
    private boolean activo = true;

    @Column(name = "cup_enabled", nullable = false)
    private boolean cupEnabled = true;

    @Column(name = "cup_size", nullable = false)
    private int cupSize = 8;

    @Column(name = "cup_nombre", length = 120)
    private String cupNombre;

    /** V65: moneda extra para quien predijo al cerrar la copa del evento. */
    @Column(name = "recompensa_moneda", nullable = false)
    private int recompensaMoneda = 0;

    /** Slug del personaje cuya carta ESPECIAL se concede como premio (null = ninguna). */
    @Column(name = "recompensa_carta_especial_slug", length = 120)
    private String recompensaCartaEspecialSlug;

    /** Código de logro a desbloquear como insignia/título del evento (null = ninguno). */
    @Column(name = "recompensa_badge_codigo", length = 80)
    private String recompensaBadgeCodigo;

    /** Si true, se concede un crédito de sobre gratis para abrir más tarde. */
    @Column(name = "recompensa_sobre_gratis", nullable = false)
    private boolean recompensaSobreGratis = false;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public String getTitulo() {
        return titulo;
    }

    public void setTitulo(String titulo) {
        this.titulo = titulo;
    }

    public String getDescripcionCorta() {
        return descripcionCorta;
    }

    public void setDescripcionCorta(String descripcionCorta) {
        this.descripcionCorta = descripcionCorta;
    }

    public EventoFiltroKind getFiltroKind() {
        return filtroKind;
    }

    public void setFiltroKind(EventoFiltroKind filtroKind) {
        this.filtroKind = filtroKind;
    }

    public String getFiltroValor() {
        return filtroValor;
    }

    public void setFiltroValor(String filtroValor) {
        this.filtroValor = filtroValor;
    }

    public LocalDateTime getInicio() {
        return inicio;
    }

    public void setInicio(LocalDateTime inicio) {
        this.inicio = inicio;
    }

    public LocalDateTime getFin() {
        return fin;
    }

    public void setFin(LocalDateTime fin) {
        this.fin = fin;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public String getEmoji() {
        return emoji;
    }

    public void setEmoji(String emoji) {
        this.emoji = emoji;
    }

    public boolean isActivo() {
        return activo;
    }

    public void setActivo(boolean activo) {
        this.activo = activo;
    }

    public boolean isCupEnabled() {
        return cupEnabled;
    }

    public void setCupEnabled(boolean cupEnabled) {
        this.cupEnabled = cupEnabled;
    }

    public int getCupSize() {
        return cupSize;
    }

    public void setCupSize(int cupSize) {
        this.cupSize = cupSize;
    }

    public String getCupNombre() {
        return cupNombre;
    }

    public void setCupNombre(String cupNombre) {
        this.cupNombre = cupNombre;
    }

    public int getRecompensaMoneda() {
        return recompensaMoneda;
    }

    public void setRecompensaMoneda(int recompensaMoneda) {
        this.recompensaMoneda = recompensaMoneda;
    }

    public String getRecompensaCartaEspecialSlug() {
        return recompensaCartaEspecialSlug;
    }

    public void setRecompensaCartaEspecialSlug(String recompensaCartaEspecialSlug) {
        this.recompensaCartaEspecialSlug = recompensaCartaEspecialSlug;
    }

    public String getRecompensaBadgeCodigo() {
        return recompensaBadgeCodigo;
    }

    public void setRecompensaBadgeCodigo(String recompensaBadgeCodigo) {
        this.recompensaBadgeCodigo = recompensaBadgeCodigo;
    }

    public boolean isRecompensaSobreGratis() {
        return recompensaSobreGratis;
    }

    public void setRecompensaSobreGratis(boolean recompensaSobreGratis) {
        this.recompensaSobreGratis = recompensaSobreGratis;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
