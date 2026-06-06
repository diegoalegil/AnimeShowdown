package com.diegoalegil.animeshowdown.dto;

import java.util.List;

/**
 * Estado completo de marcos para el usuario autenticado en una sola respuesta:
 * saldo actual (para saber qué puede comprar), marco equipado (null = ninguno)
 * y el catálogo con flags {@code poseido}/{@code equipado} por marco. Así el
 * picker del frontend pinta tienda + estado de una sola llamada.
 */
public record MarcosResponse(
        long saldo,
        String equipado,
        List<MarcoDto> marcos) {
}
