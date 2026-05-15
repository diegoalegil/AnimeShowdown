package com.diegoalegil.animeshowdown.dto;

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

    public TorneoDetalleDto() {
    }

    public List<EnfrentamientoDto> getEnfrentamientos() {
        return enfrentamientos;
    }

    public void setEnfrentamientos(List<EnfrentamientoDto> enfrentamientos) {
        this.enfrentamientos = enfrentamientos;
    }
}
