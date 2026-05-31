package com.diegoalegil.animeshowdown.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "usuario_carta_pity")
public class UsuarioCartaPity {

    @Id
    @Column(name = "usuario_id")
    private Long usuarioId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId
    @JoinColumn(name = "usuario_id")
    private Usuario usuario;

    @Column(name = "sobres_sin_especial", nullable = false)
    private int sobresSinEspecial = 0;

    @Column(name = "actualizado_en", nullable = false)
    private LocalDateTime actualizadoEn;

    public UsuarioCartaPity() {
    }

    public UsuarioCartaPity(Usuario usuario) {
        this.usuario = usuario;
    }

    @PrePersist
    @PreUpdate
    void touch() {
        actualizadoEn = LocalDateTime.now();
        if (sobresSinEspecial < 0) {
            sobresSinEspecial = 0;
        }
    }

    public Long getUsuarioId() { return usuarioId; }
    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }
    public int getSobresSinEspecial() { return sobresSinEspecial; }
    public void setSobresSinEspecial(int sobresSinEspecial) {
        this.sobresSinEspecial = Math.max(0, sobresSinEspecial);
    }
    public LocalDateTime getActualizadoEn() { return actualizadoEn; }
    public void setActualizadoEn(LocalDateTime actualizadoEn) { this.actualizadoEn = actualizadoEn; }
}
