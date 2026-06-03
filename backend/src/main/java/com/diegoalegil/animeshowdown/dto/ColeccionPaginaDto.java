package com.diegoalegil.animeshowdown.dto;

import java.util.List;

/**
 * Una página del grid de colección, filtrada por rareza/anime y troceada por
 * offset/limit sobre el catálogo. {@code totalFiltrado} permite al frontend
 * mostrar "Cargar más (N)" y {@code hayMas} indica si quedan más páginas.
 */
public record ColeccionPaginaDto(
        List<CartaDto> cartas,
        int offset,
        int limit,
        int totalFiltrado,
        boolean hayMas) {
}
