package com.diegoalegil.animeshowdown.event;

import java.time.LocalDate;

import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;

/**
 * Evento publicado tras persistir un voto.
 *
 * <p>Lo dispara {@link com.diegoalegil.animeshowdown.controller.EnfrentamientoController}
 * tras {@code votoRepository.save()}. Listeners interesados:
 * <ul>
 *   <li>{@code BadgeEventListener} — desbloquea primer_voto / cien_votos /
 *       mil_votos según el count actual del usuario.</li>
 *   <li>{@code DailyProgressVoteListener} — acumula el voto en la misión/racha
 *       diaria. Usa {@code fechaVoto} (sellada en la tx del voto) para no contar
 *       el voto en el día equivocado si el procesamiento @Async cruza medianoche.</li>
 * </ul>
 *
 * <p>Diseñado como record inmutable. Los listeners reciben los IDs y la
 * entidad ya persistida — no deben modificarlos. {@code fechaVoto} puede ser
 * null (constructores legacy): el consumidor cae a la fecha del servidor.
 */
public record VotoRegistradoEvent(Usuario usuario, Enfrentamiento enfrentamiento,
        Personaje personaje, LocalDate fechaVoto) {

    public VotoRegistradoEvent(Usuario usuario, Enfrentamiento enfrentamiento) {
        this(usuario, enfrentamiento, null, null);
    }

    public VotoRegistradoEvent(Usuario usuario, Enfrentamiento enfrentamiento, Personaje personaje) {
        this(usuario, enfrentamiento, personaje, null);
    }
}
