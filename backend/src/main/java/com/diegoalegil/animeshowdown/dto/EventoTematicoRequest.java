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
        Cup cup) {

    public record Tipo(String kind, Object valor) {}

    public record Cup(Boolean enabled, Integer tamano, String nombre) {}
}
