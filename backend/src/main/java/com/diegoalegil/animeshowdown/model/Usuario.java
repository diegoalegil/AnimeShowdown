package com.diegoalegil.animeshowdown.model;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "usuarios", indexes = {
        // El UNIQUE de username/email ya genera índice implícito en Postgres,
        // pero declararlo explícitamente con nombre estable facilita
        // migraciones futuras (Flyway) y deja claro qué columnas son hot path
        // de queries (login por username, lookup por email).
        @Index(name = "idx_usuarios_email", columnList = "email"),
        @Index(name = "idx_usuarios_username", columnList = "username")
})
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @JsonIgnore
    @Column(nullable = false)
    private String password;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(columnDefinition = "TEXT")
    private String avatarUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Rol rol;

    @Column(nullable = false)
    private LocalDateTime fechaRegistro;

    /**
     * Cuenta de logins fallidos consecutivos (Plan v2 §2.2). Se resetea a 0
     * en cada login exitoso. Si llega a 5, el AuthController setea
     * bloqueadoHasta = now + 15min y reincia el contador.
     */
    @Column(name = "intentos_fallidos", nullable = false, columnDefinition = "INTEGER DEFAULT 0")
    private Integer intentosFallidos = 0;

    /**
     * Si está seteado y es futuro, los logins responden 423 Locked sin
     * comprobar password. null = cuenta normal. Lo desactivamos automático
     * cuando se expira (no necesita unlock manual).
     */
    @Column(name = "bloqueado_hasta")
    private LocalDateTime bloqueadoHasta;

    public Usuario() {
    }

    public Usuario(String username, String password, String email) {
        this.username = username;
        this.password = password;
        this.email = email;
        this.rol = Rol.USER;
        this.fechaRegistro = LocalDateTime.now();
    }

    @PrePersist
    protected void onCreate() {
        if (this.fechaRegistro == null) {
            this.fechaRegistro = LocalDateTime.now();
        }
        if (this.rol == null) {
            this.rol = Rol.USER;
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }

    public Rol getRol() {
        return rol;
    }

    public void setRol(Rol rol) {
        this.rol = rol;
    }

    public LocalDateTime getFechaRegistro() {
        return fechaRegistro;
    }

    public void setFechaRegistro(LocalDateTime fechaRegistro) {
        this.fechaRegistro = fechaRegistro;
    }

    public Integer getIntentosFallidos() {
        return intentosFallidos == null ? 0 : intentosFallidos;
    }

    public void setIntentosFallidos(Integer intentosFallidos) {
        this.intentosFallidos = intentosFallidos == null ? 0 : intentosFallidos;
    }

    public LocalDateTime getBloqueadoHasta() {
        return bloqueadoHasta;
    }

    public void setBloqueadoHasta(LocalDateTime bloqueadoHasta) {
        this.bloqueadoHasta = bloqueadoHasta;
    }

    /** True si la cuenta tiene un bloqueo activo (no expirado). */
    public boolean estaBloqueado() {
        return bloqueadoHasta != null && bloqueadoHasta.isAfter(LocalDateTime.now());
    }

}
