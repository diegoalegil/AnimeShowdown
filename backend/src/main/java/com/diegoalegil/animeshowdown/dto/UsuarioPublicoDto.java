package com.diegoalegil.animeshowdown.dto;

import com.diegoalegil.animeshowdown.model.Usuario;

/**
 * Vista PÚBLICA de un usuario para listas de seguidos/seguidores y perfiles
 * ajenos. NO incluye email, password, intentos de login,
 * 2FA secret, ni ningún dato sensible — solo lo necesario para que otros
 * usuarios vean el avatar y el username.
 */
public record UsuarioPublicoDto(
        Long id,
        String username,
        String avatarUrl) {

    public static UsuarioPublicoDto from(Usuario u) {
        return new UsuarioPublicoDto(u.getId(), u.getUsername(), u.getAvatarUrl());
    }
}
