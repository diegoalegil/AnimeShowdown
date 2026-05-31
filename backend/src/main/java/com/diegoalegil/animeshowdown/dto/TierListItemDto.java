package com.diegoalegil.animeshowdown.dto;

import com.diegoalegil.animeshowdown.model.TierListItem;

public record TierListItemDto(
        String tier,
        int posicion,
        PersonajeMiniDto personaje) {

    public static TierListItemDto from(TierListItem item) {
        return new TierListItemDto(
                item.getTier().name(),
                item.getPosicion(),
                PersonajeMiniDto.from(item.getPersonaje()));
    }
}
