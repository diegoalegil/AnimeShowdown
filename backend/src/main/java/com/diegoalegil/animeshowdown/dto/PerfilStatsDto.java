package com.diegoalegil.animeshowdown.dto;

/**
 * Stats globales del usuario para el perfil (Plan v2 §4.1).
 *
 * <ul>
 *   <li>{@code votosTotales} — todos los votos del usuario (incluye casual).</li>
 *   <li>{@code prediccionesTotales} — predicciones registradas (resueltas + pendientes).</li>
 *   <li>{@code prediccionesAcertadas} — solo {@code acertada=true}.</li>
 *   <li>{@code porcentajeAciertos} — sobre las ya RESUELTAS, no las totales,
 *       para no penalizar predicciones aún pendientes que aún pueden acertar.</li>
 *   <li>{@code badgesDesbloqueados} — count del usuario en usuario_logros.</li>
 * </ul>
 */
public record PerfilStatsDto(
        long votosTotales,
        long prediccionesTotales,
        long prediccionesAcertadas,
        long prediccionesResueltas,
        double porcentajeAciertos,
        long badgesDesbloqueados) {
}
