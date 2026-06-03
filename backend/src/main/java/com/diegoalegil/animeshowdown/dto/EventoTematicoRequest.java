package com.diegoalegil.animeshowdown.dto;

public record EventoTematicoRequest(
        String slug,
        String titulo,
        String descripcionCorta,
        Tipo tipo,
        String inicioISO,
        String finISO,
        String color,
        String emoji,
        Boolean activo,
        Cup cup,
        Recompensa recompensa) {

    public record Tipo(String kind, Object valor) {}

    public record Cup(Boolean enabled, Integer tamano, String nombre) {}

    /** Recompensas de la copa del evento (las 4, todas opcionales). */
    public record Recompensa(Integer moneda, String cartaEspecialSlug,
            String badgeCodigo, Boolean sobreGratis) {}
}
