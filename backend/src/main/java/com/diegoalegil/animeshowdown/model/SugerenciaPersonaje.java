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

import lombok.Getter;
import lombok.Setter;

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
@Getter
public class SugerenciaPersonaje {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Setter
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Setter
    @Column(nullable = false, length = 120)
    private String nombre;

    @Setter
    @Column(nullable = false, length = 120)
    private String anime;

    @Setter
    @Column(columnDefinition = "TEXT")
    private String motivo;

    /** REGLA #7: identidad real (kanji/emblema/referencia). Obligatoria. */
    @Setter
    @Column(nullable = false, length = 300)
    private String identidad;

    @Setter
    @Column(name = "url_referencia", length = 500)
    private String urlReferencia;

    @Setter
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SugerenciaEstado estado = SugerenciaEstado.PENDIENTE;

    @Setter
    @Column(name = "motivo_rechazo", length = 500)
    private String motivoRechazo;

    @Setter
    @Column(name = "creado_en", nullable = false)
    private LocalDateTime creadoEn;

    @Setter
    @Column(name = "revisado_en")
    private LocalDateTime revisadoEn;

    public SugerenciaPersonaje() {
    }
}
