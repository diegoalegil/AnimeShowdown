package com.diegoalegil.animeshowdown.dto;

import java.util.List;

/**
 * Body opcional de PUT /api/torneos/{id}/iniciar.
 *
 * Si llega con `participantesIds` no nulo y no vacío, BracketService crea
 * el bracket completo en cascada con esos personajes (ronda 1 con datos,
 * rondas 2+ con slots vacíos). Si es null/vacío, el endpoint solo cambia
 * el estado a IN_PROGRESS — usar este modo para mantener compatibilidad
 * con flujos viejos donde los enfrentamientos se crean a mano con
 * POST /api/torneos/{id}/enfrentamientos.
 *
 * Sin @NotNull/@NotEmpty deliberadamente: el body entero es opcional.
 */
public class TorneoIniciarRequest {

    private List<Long> participantesIds;

    public TorneoIniciarRequest() {
    }

    public TorneoIniciarRequest(List<Long> participantesIds) {
        this.participantesIds = participantesIds;
    }

    public List<Long> getParticipantesIds() {
        return participantesIds;
    }

    public void setParticipantesIds(List<Long> participantesIds) {
        this.participantesIds = participantesIds;
    }
}
