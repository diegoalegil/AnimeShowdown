package com.diegoalegil.animeshowdown.dto;

import java.util.List;

/**
 * Resumen agregado "Contra quién" de un personaje (Plan producto,
 * 2026-05-18 — visión estadio otaku).
 *
 * <p>Tres listas paralelas con los top 3 rivales según tres dimensiones:
 *
 * <ul>
 *   <li>{@code mejoresMatchups}: rivales contra los que el personaje
 *       gana más veces. Orden DESC por wins.</li>
 *   <li>{@code peoresMatchups}: rivales contra los que pierde más.
 *       Orden DESC por losses.</li>
 *   <li>{@code rivalesFrecuentes}: rivales con los que se ha enfrentado
 *       más veces (suma wins + losses). Orden DESC por total.</li>
 * </ul>
 *
 * <p>{@code totalEnfrentamientos} es el número absoluto de duelos
 * decididos del personaje — el frontend lo usa para decidir si hay
 * datos suficientes ("Aún necesita más duelos" cuando es bajo).
 */
public record MatchupResumenDto(
        long totalEnfrentamientos,
        List<MatchupItem> mejoresMatchups,
        List<MatchupItem> peoresMatchups,
        List<MatchupItem> rivalesFrecuentes) {

    public record MatchupItem(
            DueloRecienteDto.PersonajeMini rival,
            int wins,
            int losses) {
        public int total() {
            return wins + losses;
        }
    }
}
