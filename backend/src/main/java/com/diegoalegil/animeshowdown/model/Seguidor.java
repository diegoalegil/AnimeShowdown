package com.diegoalegil.animeshowdown.model;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.Objects;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;

import lombok.Getter;

/**
 * Relación de seguimiento entre dos usuarios.
 *
 * <p>PK compuesta {@link SeguidorId} = (seguidor_id, seguido_id). Postgres
 * y JPA modelan PKs compuestas mejor con {@code @EmbeddedId} que con
 * {@code @IdClass} — preferimos la versión sin reflexión inversa.
 */
@Entity
@Table(name = "seguidores")
@Getter
public class Seguidor {

    @EmbeddedId
    private SeguidorId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("seguidorId")
    @JoinColumn(name = "seguidor_id")
    private Usuario seguidor;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("seguidoId")
    @JoinColumn(name = "seguido_id")
    private Usuario seguido;

    @Column(name = "fecha_inicio", nullable = false)
    private LocalDateTime fechaInicio;

    public Seguidor() {}

    public Seguidor(Usuario seguidor, Usuario seguido) {
        this.id = new SeguidorId(seguidor.getId(), seguido.getId());
        this.seguidor = seguidor;
        this.seguido = seguido;
        this.fechaInicio = LocalDateTime.now();
    }

    /** Clave compuesta del join. Embeddable para usarse con @EmbeddedId. */
    @Embeddable
    @Getter
    public static class SeguidorId implements Serializable {

        @Column(name = "seguidor_id")
        private Long seguidorId;

        @Column(name = "seguido_id")
        private Long seguidoId;

        public SeguidorId() {}

        public SeguidorId(Long seguidorId, Long seguidoId) {
            this.seguidorId = seguidorId;
            this.seguidoId = seguidoId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof SeguidorId other)) return false;
            return Objects.equals(seguidorId, other.seguidorId)
                    && Objects.equals(seguidoId, other.seguidoId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(seguidorId, seguidoId);
        }
    }
}
