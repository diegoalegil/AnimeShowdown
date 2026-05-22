package com.diegoalegil.animeshowdown.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Catálogo de logros/badges (Plan v2 §4.2). Inmutable — los registros vienen
 * del seed en V7 y nunca se modifican desde el código de aplicación. Para
 * añadir uno nuevo, una migración Flyway con un INSERT.
 *
 * <p>El campo {@link #codigo} es el identificador estable que usa el código
 * Java para desbloquear ({@code badgeService.desbloquear(usuario, "primer_voto")}).
 * El {@link #id} numérico solo importa para las FK de usuario_logros.
 */
@Entity
@Table(name = "logros")
public class Logro {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Identificador estable, ej. "primer_voto". Único. */
    @Column(nullable = false, unique = true, length = 64)
    private String codigo;

    @Column(nullable = false, length = 100)
    private String nombre;

    @Column(nullable = false, length = 300)
    private String descripcion;

    /** Nombre de icono lucide-react ("Trophy", "Crown", ...) o emoji literal. */
    @Column(nullable = false, length = 50)
    private String icono;

    /**
     * 1=COMUN, 2=POCO_COMUN, 3=RARO, 4=EPICO, 5=LEGENDARIO. El frontend lo
     * usa para elegir el color del marco del badge.
     */
    @Column(nullable = false)
    private Short rareza;

    public Logro() {}

    public Logro(String codigo, String nombre, String descripcion, String icono, Short rareza) {
        this.codigo = codigo;
        this.nombre = nombre;
        this.descripcion = descripcion;
        this.icono = icono;
        this.rareza = rareza;
    }

    public Long getId() { return id; }
    public String getCodigo() { return codigo; }
    public String getNombre() { return nombre; }
    public String getDescripcion() { return descripcion; }
    public String getIcono() { return icono; }
    public Short getRareza() { return rareza; }
}
