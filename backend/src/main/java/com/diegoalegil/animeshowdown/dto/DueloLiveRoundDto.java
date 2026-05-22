package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;

import com.diegoalegil.animeshowdown.model.DueloLiveChoice;
import com.diegoalegil.animeshowdown.model.DueloLiveRonda;
import com.diegoalegil.animeshowdown.model.DueloLiveRondaEstado;

public record DueloLiveRoundDto(
        Long id,
        int numero,
        DueloLiveRondaEstado estado,
        PersonajeMiniDto personajeA,
        PersonajeMiniDto personajeB,
        LocalDateTime serverNow,
        LocalDateTime abreEn,
        LocalDateTime cierraEn,
        DueloLiveChoice miVoto,
        DueloLiveChoice rivalVoto,
        boolean miVotoRecibido,
        boolean rivalVotoRecibido,
        DueloLiveChoice eleccionCorrecta,
        Boolean yoAcerte,
        Boolean rivalAcerto,
        Long decisionMs) {

    public static DueloLiveRoundDto from(DueloLiveRonda ronda, LocalDateTime now, boolean soyJugador1) {
        if (ronda == null) return null;
        DueloLiveChoice miVoto = soyJugador1 ? ronda.getVotoJugador1() : ronda.getVotoJugador2();
        DueloLiveChoice rivalVoto = soyJugador1 ? ronda.getVotoJugador2() : ronda.getVotoJugador1();
        Boolean yoAcerte = soyJugador1 ? ronda.getJugador1Acerto() : ronda.getJugador2Acerto();
        Boolean rivalAcerto = soyJugador1 ? ronda.getJugador2Acerto() : ronda.getJugador1Acerto();
        return new DueloLiveRoundDto(
                ronda.getId(),
                ronda.getNumero(),
                ronda.getEstado(),
                PersonajeMiniDto.from(ronda.getPersonajeA()),
                PersonajeMiniDto.from(ronda.getPersonajeB()),
                now,
                ronda.getAbreEn(),
                ronda.getCierraEn(),
                miVoto,
                rivalVoto,
                miVoto != null,
                rivalVoto != null,
                ronda.getEleccionCorrecta(),
                yoAcerte,
                rivalAcerto,
                ronda.getDecisionMs());
    }
}
