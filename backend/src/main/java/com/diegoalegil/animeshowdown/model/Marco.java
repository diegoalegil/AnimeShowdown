package com.diegoalegil.animeshowdown.model;

/**
 * Entrada del catálogo de marcos de avatar (cosmético coin-sink). Curados en
 * código ({@code MarcoCatalogo}), finitos.
 *
 * <p>{@code estilo} es una clave semántica (p.ej. {@code "aura-cian"}) que el
 * frontend mapea a clases Tailwind reusando la paleta existente — el backend no
 * conoce CSS. {@code precio} es el sink de moneda blanda; {@code rareza} es solo
 * etiqueta cosmética para ordenar/colorear en la tienda.
 */
public record Marco(
        String id,
        String nombre,
        String descripcion,
        long precio,
        String rareza,
        String estilo) {
}
