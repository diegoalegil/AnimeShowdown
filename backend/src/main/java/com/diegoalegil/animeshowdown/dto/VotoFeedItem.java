package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;

import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Voto;

/**
 * Item del feed público "Últimos votos" (Plan producto, 2026-05-18).
 *
 * <p>Lo consumimos en la home (SectionPulso) para dar sensación de
 * actividad real: "hace 3 min alguien votó por Luffy frente a Zoro".
 *
 * <p>Diseñado pensando en privacidad — exponemos solo username (no email
 * ni ID) y solo si el voto está atado a un usuario; los votos invitados
 * se anonimizan con {@code username = null} (frontend pinta "anónimo").
 *
 * <p>{@code rival} es opcional: cuando el voto es de un enfrentamiento
 * con personaje A y B (modo torneo / votar UI), pintamos "X vs Y".
 * En votos sueltos sin enfrentamiento (legacy), {@code rival} viene null
 * y el frontend pinta solo "votó por X".
 */
public record VotoFeedItem(
        LocalDateTime fecha,
        PersonajeMini ganador,
        PersonajeMini rival,
        String username) {

    public record PersonajeMini(String slug, String nombre, String anime, String imagenUrl) {
        public static PersonajeMini from(Personaje p) {
            return new PersonajeMini(p.getSlug(), p.getNombre(), p.getAnime(), p.getImagenUrl());
        }
    }

    public static VotoFeedItem from(Voto v) {
        Personaje ganador = v.getPersonaje();
        Personaje rival = null;
        if (v.getEnfrentamiento() != null) {
            // El rival es el "otro" personaje del enfrentamiento — el que
            // NO recibió el voto. Si por alguna razón el voto fue por uno
            // que no está en el enfrentamiento (no debería pasar), rival
            // queda null.
            Personaje a = v.getEnfrentamiento().getPersonaje1();
            Personaje b = v.getEnfrentamiento().getPersonaje2();
            if (a != null && ganador != null && !a.getId().equals(ganador.getId())) {
                rival = a;
            } else if (b != null && ganador != null && !b.getId().equals(ganador.getId())) {
                rival = b;
            }
        }
        return new VotoFeedItem(
                v.getFecha(),
                ganador != null ? PersonajeMini.from(ganador) : null,
                rival != null ? PersonajeMini.from(rival) : null,
                v.getUsuario() != null ? v.getUsuario().getUsername() : null);
    }
}
