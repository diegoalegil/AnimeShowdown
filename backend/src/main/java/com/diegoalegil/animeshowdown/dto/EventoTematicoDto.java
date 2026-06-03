package com.diegoalegil.animeshowdown.dto;

public record EventoTematicoDto(
        String slug,
        String titulo,
        String descripcionCorta,
        Tipo tipo,
        String inicioISO,
        String finISO,
        String color,
        String emoji,
        Cup cup) {

    public record Tipo(String kind, Object valor) {}

    public record Cup(boolean enabled, int tamano, String nombre) {}
}
