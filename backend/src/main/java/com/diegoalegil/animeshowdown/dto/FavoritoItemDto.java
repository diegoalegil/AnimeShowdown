package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;

import com.diegoalegil.animeshowdown.model.PersonajeFavorito;

/**
 * Item del roster del usuario (Plan producto 2026-05-18). Devuelve los
 * datos de Personaje suficientes para pintar la card en /perfil sin
 * que el frontend necesite cruzar con el catálogo local — slug,
 * nombre, anime e imagenUrl ya vienen aquí.
 *
 * <p>El frontend complementa con stats locales (ELO) en su lado, igual
 * que hace en otras listas.
 */
public record FavoritoItemDto(
        String slug,
        String nombre,
        String anime,
        String imagenUrl,
        LocalDateTime seguidoEn) {

    public static FavoritoItemDto from(PersonajeFavorito pf) {
        var p = pf.getPersonaje();
        return new FavoritoItemDto(
                p.getSlug(),
                p.getNombre(),
                p.getAnime(),
                p.getImagenUrl(),
                pf.getCreatedAt());
    }
}
