package com.diegoalegil.animeshowdown.dto;

import java.util.List;

/**
 * Resumen "Wrapped" de la actividad del usuario: cifras compartibles + su
 * personaje top y fandom principal. Todo se calcula server-side desde la
 * actividad real (sin inventar datos). La tarjeta visual/compartible la pinta
 * el frontend a partir de esto.
 *
 * <p>Campos honestos, NO sintéticos: las cifras son recuentos/fechas reales del
 * usuario. Cuando faltan datos se devuelve vacío/null/0 y el frontend omite esa
 * "sala" del santuario en vez de fabricar un valor.
 *
 * @param mejorRacha  racha más larga de días-calendario consecutivos votando
 *                    (0 si nunca votó, 1 si votó un único día).
 * @param top3        top 3 personajes del usuario por votos, en orden votos-desc;
 *                    nunca null (lista vacía si no ha votado).
 * @param universoTop fandom principal del usuario con el % de sus personajes top
 *                    que pertenecen a ese universo; null si no hay fandom.
 */
public record WrappedDto(
        String username,
        long votosTotales,
        long duelosJugados,
        long prediccionesAcertadas,
        long badgesDesbloqueados,
        PersonajeTop personajeTop,
        String fandomPrincipal,
        long mejorRacha,
        List<TopPersonajeItem> top3,
        UniversoTop universoTop) {

    /** Personaje más votado por el usuario (null si aún no ha votado). */
    public record PersonajeTop(String slug, String nombre, String anime, String imagenUrl) {
    }

    /**
     * Universo (anime) principal del usuario con la cuota (%) de sus personajes
     * top que pertenecen a él. {@code slug} es el de un personaje representativo
     * de ese anime (el mejor rankeado) para que el frontend resuelva el arte de
     * marca. null cuando el usuario no tiene fandom (sin votos con anime).
     */
    public record UniversoTop(String anime, String slug, int pct) {
    }
}
