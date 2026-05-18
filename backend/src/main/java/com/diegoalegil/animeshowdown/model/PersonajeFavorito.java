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

/**
 * Relación de "seguir personaje" entre Usuario y Personaje (Plan
 * producto 2026-05-18 — "Mi roster").
 *
 * <p>Mismo pattern que {@link Seguidor} (usuario→usuario): PK compuesta
 * vía {@code @EmbeddedId} para imponer la unicidad sin un unique
 * constraint extra. Sin reflexión inversa @MappedBy en Usuario/Personaje
 * — el dueño lógico es siempre el usuario.
 */
@Entity
@Table(name = "personajes_favoritos")
public class PersonajeFavorito {

    @EmbeddedId
    private PersonajeFavoritoId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("usuarioId")
    @JoinColumn(name = "usuario_id")
    private Usuario usuario;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("personajeId")
    @JoinColumn(name = "personaje_id")
    private Personaje personaje;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public PersonajeFavorito() {}

    public PersonajeFavorito(Usuario usuario, Personaje personaje) {
        this.id = new PersonajeFavoritoId(usuario.getId(), personaje.getId());
        this.usuario = usuario;
        this.personaje = personaje;
        this.createdAt = LocalDateTime.now();
    }

    public PersonajeFavoritoId getId() { return id; }
    public Usuario getUsuario() { return usuario; }
    public Personaje getPersonaje() { return personaje; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    @Embeddable
    public static class PersonajeFavoritoId implements Serializable {

        @Column(name = "usuario_id")
        private Long usuarioId;

        @Column(name = "personaje_id")
        private Long personajeId;

        public PersonajeFavoritoId() {}

        public PersonajeFavoritoId(Long usuarioId, Long personajeId) {
            this.usuarioId = usuarioId;
            this.personajeId = personajeId;
        }

        public Long getUsuarioId() { return usuarioId; }
        public Long getPersonajeId() { return personajeId; }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof PersonajeFavoritoId other)) return false;
            return Objects.equals(usuarioId, other.usuarioId)
                    && Objects.equals(personajeId, other.personajeId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(usuarioId, personajeId);
        }
    }
}
