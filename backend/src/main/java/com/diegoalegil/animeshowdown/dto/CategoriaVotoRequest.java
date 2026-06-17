package com.diegoalegil.animeshowdown.dto;

/**
 * Body del PATCH que fija la intención de un voto ya emitido (feature #15):
 * {@code { "categoria": "poder" }}. Sin validación de enum — una categoría
 * blank/desconocida se trata como no-op en el controller (la intención es
 * opcional). El valor es el id de wire de {@link
 * com.diegoalegil.animeshowdown.model.CategoriaVoto}.
 */
public record CategoriaVotoRequest(String categoria) {
}
