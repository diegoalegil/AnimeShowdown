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
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * Carta del catálogo coleccionable. Cada carta deriva de un {@link Personaje}
 * (su arte + universo) y tiene una {@link RarezaCarta}. Decisión del owner:
 * 1 carta normal (SSR) por personaje; la ESPECIAL es curada y opcional. Las
 * especiales pueden tener variantes por personaje (p.ej. formas alternativas).
 *
 * <p>El catálogo se sincroniza desde los personajes en runtime
 * (CartaCatalogoService) porque los personajes se importan en el arranque, no
 * en las migraciones.
 */
@Entity
@Table(name = "carta", indexes = {
        @Index(name = "idx_carta_rareza", columnList = "rareza")
})
@Getter
public class Carta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "personaje_id", nullable = false)
    @Setter
    private Personaje personaje;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Setter
    private RarezaCarta rareza;

    /** True sólo para las ESPECIAL curadas a mano por el owner. */
    @Column(name = "especial_curada", nullable = false)
    @Setter
    private boolean especialCurada = false;

    @Column(nullable = false, length = 64)
    private String variante = "";

    @Column(name = "arte_url", length = 500)
    @Setter
    private String arteUrl;

    @Column(name = "creado_en", nullable = false)
    @Setter
    private LocalDateTime creadoEn;

    public Carta() {
    }

    public Carta(Personaje personaje, RarezaCarta rareza) {
        this.personaje = personaje;
        this.rareza = rareza;
    }

    @PrePersist
    void onCreate() {
        if (creadoEn == null) {
            creadoEn = LocalDateTime.now();
        }
        if (variante == null) {
            variante = "";
        }
    }

    public void setVariante(String variante) { this.variante = variante != null ? variante : ""; }
}
