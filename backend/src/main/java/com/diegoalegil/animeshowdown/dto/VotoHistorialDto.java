package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;

import com.diegoalegil.animeshowdown.model.Voto;

/**
 * Entrada del historial de votos del usuario.
 *
 * <p>Para votos de enfrentamientos reales, {@code enfrentamientoId} no es
 * null y se incluye el oponente (el otro personaje del match). Para votos
 * del modo casual, {@code enfrentamientoId} es null y solo
 * se rellena el personaje al que votaste.
 */
public record VotoHistorialDto(
        Long id,
        LocalDateTime fecha,
        Long personajeId,
        String personajeSlug,
        String personajeNombre,
        String personajeImagenUrl,
        Long enfrentamientoId,
        Long oponenteId,
        String oponenteSlug,
        String oponenteNombre,
        Long torneoId,
        String torneoSlug,
        String torneoNombre) {

    public static VotoHistorialDto from(Voto v) {
        var p = v.getPersonaje();
        Long enfId = null, oponenteId = null;
        String oponenteSlug = null, oponenteNombre = null;
        Long torneoId = null;
        String torneoSlug = null, torneoNombre = null;

        var enf = v.getEnfrentamiento();
        if (enf != null) {
            enfId = enf.getId();
            // El oponente es el que NO es el personaje al que votó el user.
            var oponente = enf.getPersonaje1() != null
                    && enf.getPersonaje1().getId().equals(p.getId())
                    ? enf.getPersonaje2()
                    : enf.getPersonaje1();
            if (oponente != null) {
                oponenteId = oponente.getId();
                oponenteSlug = oponente.getSlug();
                oponenteNombre = oponente.getNombre();
            }
            var torneo = enf.getTorneo();
            if (torneo != null) {
                torneoId = torneo.getId();
                torneoSlug = torneo.getSlug();
                torneoNombre = torneo.getNombre();
            }
        }

        return new VotoHistorialDto(
                v.getId(),
                v.getFecha(),
                p.getId(),
                p.getSlug(),
                p.getNombre(),
                p.getImagenUrl(),
                enfId, oponenteId, oponenteSlug, oponenteNombre,
                torneoId, torneoSlug, torneoNombre);
    }
}
