package com.diegoalegil.animeshowdown.model;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "votos", uniqueConstraints = {
        // se eliminó uk_voto_personaje_usuario (un voto
        // por usuario y personaje globalmente). Bloqueaba votos legítimos en
        // rondas distintas del bracket cuando un personaje avanzaba: usuario
        // votó Luffy en R1 y al votarlo en R2 el constraint reventaba con
        // 500. La V16 lo dropea de la BBDD; aquí lo eliminamos del modelo.
        // El uniqueness real (un voto por usuario y enfrentamiento) lo cubre
        // uk_voto_enfrentamiento_usuario, que sí es semánticamente correcto.
        @UniqueConstraint(name = "uk_voto_enfrentamiento_usuario", columnNames = { "enfrentamiento_id", "usuario_id" }),
        // unicidad de votos anónimos por
        // sesión, declarada también en JPA para que ddl-auto=validate la
        // reconozca contra el schema real (V30). NULL != NULL en SQL hace
        // que la combinación solo se constrainee cuando ambos campos están
        // presentes — es decir, solo para votos anónimos con sesión, sin
        // afectar a votos registrados (anon_session_id NULL).
        @UniqueConstraint(name = "uk_voto_enfrentamiento_anon_session", columnNames = { "enfrentamiento_id", "anon_session_id" })
}, indexes = {
        // Queries hot path: GROUP BY personaje en el ranking,
        // countByEnfrentamientoAndPersonaje al cerrar torneos, y los DELETE
        // de cascada del DataSeeder. Queremos índices simples sobre cada FK
        // para acelerar lookups por una columna.
        @Index(name = "idx_votos_personaje", columnList = "personaje_id"),
        @Index(name = "idx_votos_enfrentamiento", columnList = "enfrentamiento_id"),
        // rankingDesde/rankingHasta filtran por
        // votos.fecha (RankingMovimientosService). V18 lo materializa
        // explícito en BBDD; declarar aquí mantiene en sync el esquema
        // de Hibernate validate.
        @Index(name = "idx_votos_fecha", columnList = "fecha")
})
@Getter
public class Voto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter
    private Long id;

    @Column(nullable = false, updatable = false)
    @Setter
    private LocalDateTime fecha;

    @Column(nullable = false, precision = 4, scale = 2)
    private BigDecimal peso = BigDecimal.ONE;

    @Column(name = "anon_session_id", length = 64)
    @Setter
    private String anonSessionId;

    @Column(name = "anon_ip_hash", length = 64)
    @Setter
    private String anonIpHash;

    @Column(name = "empate", nullable = false)
    @Setter
    private boolean empate = false;

    @ManyToOne
    @JoinColumn(name = "personaje_id", nullable = false)
    @Setter
    private Personaje personaje;

    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "usuario_id", nullable = true)
    @Setter
    private Usuario usuario;

    @ManyToOne
    @JoinColumn(name = "enfrentamiento_id", nullable = true)
    @Setter
    private Enfrentamiento enfrentamiento;

    // Intención de voto (feature #15): el "por qué" OPCIONAL del voto.
    // NULL = sin intención → el voto sigue contando 1:1 en el ranking global
    // (los GROUP BY del ranking no filtran por esta columna). Guardamos el id
    // de wire (kebab) de CategoriaVoto, no el name() del enum, para que
    // DB ↔ API ↔ URL ↔ frontend sean idénticos. length=24 cubre el id más
    // largo de la lista cerrada con holgura. La columna la crea V37; declararla
    // aquí mantiene en sync el esquema con ddl-auto=validate.
    @Column(name = "categoria", length = 24)
    @Setter
    private String categoria;

    public Voto() {
    }

    public Voto(Personaje personaje) {
        this.personaje = personaje;
        this.fecha = LocalDateTime.now();
    }

    public Voto(Personaje personaje, Usuario usuario) {
        this.personaje = personaje;
        this.usuario = usuario;
        this.fecha = LocalDateTime.now();
    }

    public Voto(Personaje personaje, Usuario usuario, Enfrentamiento enfrentamiento) {
        this.personaje = personaje;
        this.usuario = usuario;
        this.enfrentamiento = enfrentamiento;
        this.fecha = LocalDateTime.now();
    }

    @PrePersist
    protected void onCreate() {
        if (this.fecha == null) {
            this.fecha = LocalDateTime.now();
        }
    }

    public void setPeso(BigDecimal peso) {
        this.peso = peso == null ? BigDecimal.ONE : peso;
    }
}
