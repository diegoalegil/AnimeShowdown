package com.diegoalegil.animeshowdown.dto;

import com.diegoalegil.animeshowdown.model.Rol;
import com.diegoalegil.animeshowdown.model.Usuario;

public class UsuarioRespuesta {

    private Long id;
    private String username;
    private String email;
    private Rol rol;

    public UsuarioRespuesta(Usuario usuario) {
        this.id = usuario.getId();
        this.username = usuario.getUsername();
        this.email = usuario.getEmail();
        this.rol = usuario.getRol();
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getEmail() {
        return email;
    }

    public Rol getRol() {
        return rol;
    }
}
