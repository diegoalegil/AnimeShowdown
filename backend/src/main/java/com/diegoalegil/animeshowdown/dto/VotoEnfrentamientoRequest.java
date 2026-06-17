package com.diegoalegil.animeshowdown.dto;

public record VotoEnfrentamientoRequest(
        Long personajeGanadorId,
        boolean empate,

        // Intención de voto (feature #15): el "por qué" OPCIONAL. Deliberadamente
        // SIN @NotNull ni validación de enum — una categoría blank/desconocida
        // degrada a "voto sin intención" (CategoriaVoto.fromId → null), nunca
        // rechaza el voto. El cliente la manda como id de wire ('poder',
        // 'mejor-villano'…). En la práctica casi siempre llega null en el POST: la
        // intención se fija después en un segundo tap vía PATCH set-once.
        String categoria) {
}
