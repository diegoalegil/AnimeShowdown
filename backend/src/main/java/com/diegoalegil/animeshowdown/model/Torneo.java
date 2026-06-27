package com.diegoalegil.animeshowdown.model;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonIgnore;

import lombok.Getter;
import lombok.Setter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "torneos")
@Getter
@Setter
public class Torneo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * URL-safe identifier para frontend (`/torneos/best-girls-2026`). Único.
     * Lo genera automáticamente {@link #onCreate} desde el nombre si no se
     * proporcionó explícitamente. La unicidad se garantiza en TorneoService
     * con sufijos numéricos si hay colisión.
     *
     * En DDL queda nullable para no romper migrate de filas viejas; a nivel
     * app está siempre presente (PrePersist + servicio).
     */
    @Column(unique = true, length = 80)
    private String slug;

    @Column(nullable = false)
    private String nombre;

    @Column(length = 500)
    private String descripcion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EstadoTorneo estado;

    private LocalDateTime fechaCreacion;

    private LocalDateTime fechaInicio;

    private LocalDateTime fechaFinalizacion;

    /**
     * Ganador del torneo. Para torneos completos coincide con el ganador
     * del match de la última ronda — lo setea TorneoService.finalizar.
     * Para torneos legacy seedados sin bracket detallado (1
     * commit 6), este campo es la única fuente de verdad del ganador.
     */
    // @JsonIgnore: defensa en profundidad. Las respuestas de torneo usan DTOs
    // (TorneoMioDto/Resumen/Detalle con ganadorSlug ya proyectado); la relación
    // cruda nunca debe serializarse aunque algún endpoint devuelva la entidad.
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ganador_personaje_id")
    private Personaje ganadorPersonaje;

    /**
     * User que creó el torneo. NULL en torneos legacy creados por admin
     * antes del 9, o si el creador se borra (ON DELETE SET NULL).
     */
    // @JsonIgnore: evita filtrar el Usuario creador (incluido su email) si la
    // entidad se serializa por accidente. El owner se proyecta en DTOs cuando
    // hace falta; nunca debe viajar el Usuario completo en una respuesta pública.
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id")
    private Usuario creadoPor;

    /**
     * Estado de revisión administrativa. Los torneos creados
     * por admin nacen como {@link EstadoRevision#NO_APLICA} y son visibles
     * inmediatamente. Los creados por user nacen como PENDIENTE y solo se
     * exponen al público una vez APROBADO.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "estado_revision", nullable = false, length = 20)
    private EstadoRevision estadoRevision;

    /** Motivo del admin si {@link #estadoRevision} es RECHAZADO. */
    @Column(name = "motivo_rechazo", columnDefinition = "TEXT")
    private String motivoRechazo;

    @Column(name = "fecha_revisado")
    private LocalDateTime fechaRevisado;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private VisibilidadTorneo visibilidad;

    @Column(nullable = false)
    private boolean publico = true;

    @Column(name = "auto_generado", nullable = false)
    private boolean autoGenerado = false;

    /** V66: torneo-sistema "Arena" sin bracket (pool de duelos del roster). */
    @Column(name = "es_arena", nullable = false)
    private boolean esArena = false;

    @Column(name = "evento_slug", length = 80)
    private String eventoSlug;

    @Column(name = "auto_origen", length = 80)
    private String autoOrigen;

    public Torneo() {
    }

    public Torneo(String nombre, String descripcion) {
        this.nombre = nombre;
        this.descripcion = descripcion;
        this.estado = EstadoTorneo.SCHEDULED;
        this.fechaCreacion = LocalDateTime.now();
    }

    public Torneo(String slug, String nombre, String descripcion) {
        this(nombre, descripcion);
        this.slug = slug;
    }

    @PrePersist
    protected void onCreate() {
        if (this.fechaCreacion == null) {
            this.fechaCreacion = LocalDateTime.now();
        }
        if (this.estado == null) {
            this.estado = EstadoTorneo.SCHEDULED;
        }
        if (this.estadoRevision == null) {
            // Default seguro: si entra sin estado explícito asumimos legacy
            // (admin → NO_APLICA). Los torneos de usuario los marca
            // explícitamente TorneoService.crearPorUsuario().
            this.estadoRevision = EstadoRevision.NO_APLICA;
        }
        if (this.visibilidad == null) {
            this.visibilidad = VisibilidadTorneo.PUBLICO;
        }
        if (this.slug == null || this.slug.isBlank()) {
            // Fallback defensivo: si llegamos aquí sin slug es bug en la capa
            // de servicio, pero garantizamos UNIQUE generando uno provisional
            // a partir del nombre. TorneoService.crear() debe haberlo seteado
            // ya con SlugUtil + check de unicidad.
            this.slug = SlugUtil.slugify(this.nombre) + "-" + System.currentTimeMillis();
        }
    }

}
