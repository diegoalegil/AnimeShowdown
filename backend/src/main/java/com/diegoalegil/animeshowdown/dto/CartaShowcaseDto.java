package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;

import com.diegoalegil.animeshowdown.model.CartaShowcase;

public record CartaShowcaseDto(
        String slot,
        String username,
        CartaDto carta,
        LocalDateTime actualizadoEn) {

    public static CartaShowcaseDto from(CartaShowcase showcase) {
        return new CartaShowcaseDto(
                showcase.getSlot().name(),
                showcase.getUsuario().getUsername(),
                CartaDto.from(showcase.getCarta(), null),
                showcase.getActualizadoEn());
    }
}
