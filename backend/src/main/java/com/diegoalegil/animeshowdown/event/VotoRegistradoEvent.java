package com.diegoalegil.animeshowdown.event;

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
 *   <li>(Futuro) listeners de retención: streaks diarios, recomendaciones,
 *       etc.</li>
 * </ul>
 *
 * <p>Diseñado como record inmutable. Los listeners reciben los IDs y la
 * entidad ya persistida — no deben modificarlos.
 */
public record VotoRegistradoEvent(Usuario usuario, Enfrentamiento enfrentamiento, Personaje personaje) {

    public VotoRegistradoEvent(Usuario usuario, Enfrentamiento enfrentamiento) {
        this(usuario, enfrentamiento, null);
    }
}
