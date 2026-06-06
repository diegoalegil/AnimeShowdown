package com.diegoalegil.animeshowdown.dto;

/**
 * Resumen "Wrapped" de la actividad del usuario: cifras compartibles + su
 * personaje top y fandom principal. Todo se calcula server-side desde la
 * actividad real (sin inventar datos). La tarjeta visual/compartible la pinta
 * el frontend a partir de esto.
 */
public record WrappedDto(
        String username,
        long votosTotales,
        long duelosJugados,
        long prediccionesAcertadas,
        long badgesDesbloqueados,
        PersonajeTop personajeTop,
        String fandomPrincipal) {

    /** Personaje más votado por el usuario (null si aún no ha votado). */
    public record PersonajeTop(String slug, String nombre, String anime, String imagenUrl) {
    }
}
