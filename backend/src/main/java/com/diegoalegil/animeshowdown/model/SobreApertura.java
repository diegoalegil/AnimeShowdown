package com.diegoalegil.animeshowdown.model;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "sobre_apertura")
@Getter
public class SobreApertura {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Setter
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Setter
    @Column(name = "idempotency_key", nullable = false, length = 96)
    private String idempotencyKey;

    @Setter
    @Column(nullable = false)
    private long precio;

    @Setter
    @Column(name = "saldo_restante", nullable = false)
    private long saldoRestante;

    @Setter
    @Column(nullable = false)
    private boolean especial;

    @Setter
    @Column(name = "pity_antes", nullable = false)
    private int pityAntes;

    @Setter
    @Column(name = "pity_despues", nullable = false)
    private int pityDespues;

    @Setter
    @Column(name = "monedas_duplicados", nullable = false)
    private long monedasDuplicados;

    @Setter
    @Column(name = "creado_en", nullable = false)
    private LocalDateTime creadoEn;

    @Setter
    @OneToMany(mappedBy = "sobre", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SobreAperturaItem> items = new ArrayList<>();

    public SobreApertura() {
    }

    public SobreApertura(Usuario usuario, String idempotencyKey) {
        this.usuario = usuario;
        this.idempotencyKey = idempotencyKey;
    }

    @PrePersist
    void onCreate() {
        if (creadoEn == null) {
            creadoEn = LocalDateTime.now();
        }
    }

    public void addItem(SobreAperturaItem item) {
        item.setSobre(this);
        items.add(item);
    }
}
