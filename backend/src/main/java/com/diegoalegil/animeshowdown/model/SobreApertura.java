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

@Entity
@Table(name = "sobre_apertura")
public class SobreApertura {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "idempotency_key", nullable = false, length = 96)
    private String idempotencyKey;

    @Column(nullable = false)
    private long precio;

    @Column(name = "saldo_restante", nullable = false)
    private long saldoRestante;

    @Column(nullable = false)
    private boolean especial;

    @Column(name = "pity_antes", nullable = false)
    private int pityAntes;

    @Column(name = "pity_despues", nullable = false)
    private int pityDespues;

    @Column(name = "monedas_duplicados", nullable = false)
    private long monedasDuplicados;

    @Column(name = "creado_en", nullable = false)
    private LocalDateTime creadoEn;

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

    public Long getId() { return id; }
    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
    public long getPrecio() { return precio; }
    public void setPrecio(long precio) { this.precio = precio; }
    public long getSaldoRestante() { return saldoRestante; }
    public void setSaldoRestante(long saldoRestante) { this.saldoRestante = saldoRestante; }
    public boolean isEspecial() { return especial; }
    public void setEspecial(boolean especial) { this.especial = especial; }
    public int getPityAntes() { return pityAntes; }
    public void setPityAntes(int pityAntes) { this.pityAntes = pityAntes; }
    public int getPityDespues() { return pityDespues; }
    public void setPityDespues(int pityDespues) { this.pityDespues = pityDespues; }
    public long getMonedasDuplicados() { return monedasDuplicados; }
    public void setMonedasDuplicados(long monedasDuplicados) { this.monedasDuplicados = monedasDuplicados; }
    public LocalDateTime getCreadoEn() { return creadoEn; }
    public void setCreadoEn(LocalDateTime creadoEn) { this.creadoEn = creadoEn; }
    public List<SobreAperturaItem> getItems() { return items; }
    public void setItems(List<SobreAperturaItem> items) { this.items = items; }
}
