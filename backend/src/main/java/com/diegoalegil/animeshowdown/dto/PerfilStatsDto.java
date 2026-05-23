package com.diegoalegil.animeshowdown.dto;

/**
 * Stats globales del usuario para el perfil.
 *
 * <ul>
 *   <li>{@code votosTotales} — todos los votos del usuario (incluye casual).</li>
 *   <li>{@code prediccionesTotales} — predicciones registradas (resueltas + pendientes).</li>
 *   <li>{@code prediccionesAcertadas} — solo {@code acertada=true}.</li>
 *   <li>{@code porcentajeAciertos} — sobre las ya RESUELTAS, no las totales,
 *       para no penalizar predicciones aún pendientes que aún pueden acertar.</li>
 *   <li>{@code badgesDesbloqueados} — count del usuario en usuario_logros.</li>
 *   <li>{@code torneosCreados} — count de torneos UGC creados por el usuario
 *       (todos los estados: pendientes, aprobados, rechazados).</li>
 * </ul>
 */
public record PerfilStatsDto(
        long votosTotales,
        long prediccionesTotales,
        long prediccionesAcertadas,
        long prediccionesResueltas,
        double porcentajeAciertos,
        long badgesDesbloqueados,
        long torneosCreados,
        int eloPvp,
        int pvpPartidos) {
}
