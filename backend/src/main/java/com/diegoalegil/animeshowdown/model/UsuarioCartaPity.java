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
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "usuario_carta_pity")
@Getter
public class UsuarioCartaPity {

    @Id
    @Column(name = "usuario_id")
    private Long usuarioId;

    @Setter
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId
    @JoinColumn(name = "usuario_id")
    private Usuario usuario;

    @Column(name = "sobres_sin_especial", nullable = false)
    private int sobresSinEspecial = 0;

    @Setter
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

    public void setSobresSinEspecial(int sobresSinEspecial) {
        this.sobresSinEspecial = Math.max(0, sobresSinEspecial);
    }
}
