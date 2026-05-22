package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Vista completa de un torneo: resumen + array de enfrentamientos ordenado
 * por (ronda asc, id asc). El frontend Bracket.jsx itera este array y pinta
 * las cards en su posición correspondiente. Devuelta por:
 *
 *   GET /api/torneos/slug/{slug}
 *   GET /api/torneos/{id}
 */
public class TorneoDetalleDto extends TorneoResumenDto {

    private List<EnfrentamientoDto> enfrentamientos;
    private EnfrentamientoDto currentMatch;
    private LocalDateTime liveServerNow;
    private LocalDateTime liveEndsAt;

    public TorneoDetalleDto() {
    }

    public List<EnfrentamientoDto> getEnfrentamientos() {
        return enfrentamientos;
    }

    public void setEnfrentamientos(List<EnfrentamientoDto> enfrentamientos) {
        this.enfrentamientos = enfrentamientos;
    }

    public EnfrentamientoDto getCurrentMatch() {
        return currentMatch;
    }

    public void setCurrentMatch(EnfrentamientoDto currentMatch) {
        this.currentMatch = currentMatch;
    }

    public LocalDateTime getLiveServerNow() {
        return liveServerNow;
    }

    public void setLiveServerNow(LocalDateTime liveServerNow) {
        this.liveServerNow = liveServerNow;
    }

    public LocalDateTime getLiveEndsAt() {
        return liveEndsAt;
    }

    public void setLiveEndsAt(LocalDateTime liveEndsAt) {
        this.liveEndsAt = liveEndsAt;
    }
}
