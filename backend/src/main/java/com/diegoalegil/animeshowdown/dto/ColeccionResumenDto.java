package com.diegoalegil.animeshowdown.dto;

import java.util.List;

/**
 * Resumen de la colección SIN el array de cartas: totales, saldo, pity, flags y
 * agregados por anime y por rareza. Es la "cabecera" de la página de colección;
 * el grid se pagina aparte con {@link ColeccionPaginaDto} vía
 * GET /api/me/cartas/pagina. Así una colección de miles de cartas no obliga a
 * serializar el catálogo entero en cada visita.
 */
public record ColeccionResumenDto(
        int totalCatalogo,
        int totalPoseidas,
        int porcentaje,
        long saldo,
        int pityActual,
        int pityDuro,
        boolean cofreDiarioDisponible,
        boolean sobreBienvenidaDisponible,
        int sobresGratisPendientes,
        List<ColeccionAnimeDto> progresoPorAnime,
        List<RarezaResumenDto> progresoPorRareza) {
}
