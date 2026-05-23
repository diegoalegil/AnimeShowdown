package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;

import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.Personaje;

/**
 * Fila del "Historial de duelos" en la ficha de personaje.
 *
 * <p>Resume un enfrentamiento desde la perspectiva de UN personaje
 * concreto (el "yo" en la ficha): muestra el rival, el resultado para
 * mí (WIN/LOSS/PENDING) y la fecha + torneo donde ocurrió. Diseñado
 * para listas compactas — no incluye stats agregadas, eso vive en
 * MatchupResumenDto.
 *
 * <p>Privacidad: no expone usuario alguno. Solo personajes (ya
 * públicos) + nombre del torneo. Los votos son aggregate público.
 */
public record DueloRecienteDto(
        Long enfrentamientoId,
        LocalDateTime fecha,
        PersonajeMini rival,
        Resultado resultado,
        String torneoNombre,
        String torneoSlug) {

    public enum Resultado { WIN, LOSS, PENDING }

    public record PersonajeMini(String slug, String nombre, String anime, String imagenUrl) {
        public static PersonajeMini from(Personaje p) {
            return new PersonajeMini(p.getSlug(), p.getNombre(), p.getAnime(), p.getImagenUrl());
        }
    }

    public static DueloRecienteDto from(Enfrentamiento e, Personaje yo) {
        Personaje rival = mismoId(e.getPersonaje1(), yo) ? e.getPersonaje2() : e.getPersonaje1();
        Resultado resultado;
        if (e.getGanador() == null) {
            resultado = Resultado.PENDING;
        } else {
            resultado = mismoId(e.getGanador(), yo) ? Resultado.WIN : Resultado.LOSS;
        }
        var torneo = e.getTorneo();
        return new DueloRecienteDto(
                e.getId(),
                e.getFechaCreacion(),
                rival != null ? PersonajeMini.from(rival) : null,
                resultado,
                torneo != null ? torneo.getNombre() : null,
                torneo != null ? torneo.getSlug() : null);
    }

    private static boolean mismoId(Personaje a, Personaje b) {
        return a != null && b != null && a.getId() != null && a.getId().equals(b.getId());
    }
}
