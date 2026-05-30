package com.diegoalegil.animeshowdown.dto;

import java.util.List;

/**
 * Vista de colección: catálogo completo + cuáles posee el usuario + progreso +
 * saldo de moneda. El frontend pinta el grid de obtenidas vs faltantes.
 */
public record ColeccionDto(
        int totalCatalogo,
        int totalPoseidas,
        int porcentaje,
        long saldo,
        List<CartaDto> cartas) {
}
