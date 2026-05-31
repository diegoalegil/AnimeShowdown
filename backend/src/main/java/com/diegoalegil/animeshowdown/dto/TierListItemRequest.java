package com.diegoalegil.animeshowdown.dto;

public record TierListItemRequest(
        Long personajeId,
        String tier,
        Integer posicion) {
}
