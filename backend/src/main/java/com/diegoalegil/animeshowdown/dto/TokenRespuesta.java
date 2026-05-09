package com.diegoalegil.animeshowdown.dto;

public class TokenRespuesta {

    private String token;
    private UsuarioRespuesta usuario;

    public TokenRespuesta(String token) {
        this.token = token;
    }

    public TokenRespuesta(String token, UsuarioRespuesta usuario) {
        this.token = token;
        this.usuario = usuario;
    }

    public String getToken() {
        return token;
    }

    public UsuarioRespuesta getUsuario() {
        return usuario;
    }
}
