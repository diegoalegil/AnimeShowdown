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
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "sobre_apertura_item")
@Getter
public class SobreAperturaItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Setter
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sobre_apertura_id", nullable = false)
    private SobreApertura sobre;

    @Setter
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "carta_id", nullable = false)
    private Carta carta;

    @Setter
    @Column(nullable = false)
    private int posicion;

    @Setter
    @Column(nullable = false)
    private boolean nueva;

    @Setter
    @Column(name = "recompensa_duplicado", nullable = false)
    private long recompensaDuplicado;

    @Setter
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
}
