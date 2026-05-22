package com.diegoalegil.animeshowdown.dto;

import com.diegoalegil.animeshowdown.model.Usuario;

public record DueloLivePlayerDto(
        Long id,
        String username,
        String avatarUrl,
        int eloPvp,
        boolean bot) {

    public static DueloLivePlayerDto from(Usuario usuario) {
        if (usuario == null) return null;
        return new DueloLivePlayerDto(
                usuario.getId(),
                usuario.getUsername(),
                usuario.getAvatarUrl(),
                usuario.getEloPvp(),
                false);
    }

    public static DueloLivePlayerDto botPlayer() {
        return new DueloLivePlayerDto(null, "AnimeShowdown Bot", null, 1000, true);
    }
}
