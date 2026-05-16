package com.diegoalegil.animeshowdown.dto;

import com.diegoalegil.animeshowdown.model.EstadoVerificacion;
import com.diegoalegil.animeshowdown.model.Rol;
import com.diegoalegil.animeshowdown.model.Usuario;

public class UsuarioRespuesta {

    private Long id;
    private String username;
    private String email;
    private String avatarUrl;
    private Rol rol;
    /**
     * Estado de verificación de email (Plan v2 §2.4). El frontend lo usa
     * para decidir si pintar el banner "Verifica tu email" y bloquear
     * acciones que requieren ACTIVO (votar, crear torneos).
     */
    private EstadoVerificacion estadoVerificacion;

    public UsuarioRespuesta(Usuario usuario) {
        this.id = usuario.getId();
        this.username = usuario.getUsername();
        this.email = usuario.getEmail();
        this.avatarUrl = usuario.getAvatarUrl();
        this.rol = usuario.getRol();
        this.estadoVerificacion = usuario.getEstadoVerificacion();
    }

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public String getEmail() { return email; }
    public String getAvatarUrl() { return avatarUrl; }
    public Rol getRol() { return rol; }
    public EstadoVerificacion getEstadoVerificacion() { return estadoVerificacion; }
}
