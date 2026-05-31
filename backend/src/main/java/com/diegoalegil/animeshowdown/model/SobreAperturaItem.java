package com.diegoalegil.animeshowdown.model;

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
import jakarta.persistence.Table;

@Entity
@Table(name = "sobre_apertura_item")
public class SobreAperturaItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sobre_apertura_id", nullable = false)
    private SobreApertura sobre;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "carta_id", nullable = false)
    private Carta carta;

    @Column(nullable = false)
    private int posicion;

    @Column(nullable = false)
    private boolean nueva;

    @Column(name = "recompensa_duplicado", nullable = false)
    private long recompensaDuplicado;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private CartaClimax climax;

    public SobreAperturaItem() {
    }

    public SobreAperturaItem(Carta carta, int posicion, boolean nueva,
            long recompensaDuplicado, CartaClimax climax) {
        this.carta = carta;
        this.posicion = posicion;
        this.nueva = nueva;
        this.recompensaDuplicado = recompensaDuplicado;
        this.climax = climax;
    }

    public Long getId() { return id; }
    public SobreApertura getSobre() { return sobre; }
    public void setSobre(SobreApertura sobre) { this.sobre = sobre; }
    public Carta getCarta() { return carta; }
    public void setCarta(Carta carta) { this.carta = carta; }
    public int getPosicion() { return posicion; }
    public void setPosicion(int posicion) { this.posicion = posicion; }
    public boolean isNueva() { return nueva; }
    public void setNueva(boolean nueva) { this.nueva = nueva; }
    public long getRecompensaDuplicado() { return recompensaDuplicado; }
    public void setRecompensaDuplicado(long recompensaDuplicado) {
        this.recompensaDuplicado = recompensaDuplicado;
    }
    public CartaClimax getClimax() { return climax; }
    public void setClimax(CartaClimax climax) { this.climax = climax; }
}
