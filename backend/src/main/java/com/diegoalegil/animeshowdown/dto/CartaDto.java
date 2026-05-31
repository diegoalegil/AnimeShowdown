package com.diegoalegil.animeshowdown.dto;

import com.diegoalegil.animeshowdown.model.Carta;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.RarezaCarta;
import com.diegoalegil.animeshowdown.model.UsuarioCarta;

/**
 * Carta del catálogo enriquecida con la posesión del usuario. Cada carta lleva
 * el arte y universo del personaje (regla #7: nada genérico) — slug + nombre +
 * anime + imagen + color dominante para que el frontend reutilice el lenguaje
 * de la carta SSR existente.
 */
public record CartaDto(
        Long id,
        String personajeSlug,
        String personajeNombre,
        String anime,
        String imagenUrl,
        String colorDominante,
        RarezaCarta rareza,
        boolean especialCurada,
        String variante,
        String arteUrl,
        long elo,
        boolean poseida,
        int cantidad) {

    /** Carta del catálogo con (o sin) posesión del usuario. {@code propia} puede ser null. */
    public static CartaDto from(Carta carta, UsuarioCarta propia) {
        return from(carta, propia, 0L);
    }

    public static CartaDto from(Carta carta, UsuarioCarta propia, long elo) {
        Personaje p = carta.getPersonaje();
        return new CartaDto(
                carta.getId(),
                p.getSlug(),
                p.getNombre(),
                p.getAnime(),
                p.getImagenUrl(),
                p.getImagenColorDominante(),
                carta.getRareza(),
                carta.isEspecialCurada(),
                carta.getVariante(),
                carta.getArteUrl(),
                Math.max(0L, elo),
                propia != null,
                propia != null ? propia.getCantidad() : 0);
    }
}
