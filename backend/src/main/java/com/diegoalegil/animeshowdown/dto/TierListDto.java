package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

import com.diegoalegil.animeshowdown.model.TierList;
import com.diegoalegil.animeshowdown.model.TierListItem;

public record TierListDto(
        Long id,
        String slug,
        String titulo,
        String animeSlug,
        boolean publico,
        String username,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<TierListItemDto> items) {

    public static TierListDto from(TierList tierList) {
        List<TierListItemDto> orderedItems = tierList.getItems()
                .stream()
                .sorted(Comparator
                        .comparing((TierListItem item) -> item.getTier().ordinal())
                        .thenComparingInt(TierListItem::getPosicion)
                        .thenComparing(item -> item.getPersonaje().getNombre(), String.CASE_INSENSITIVE_ORDER))
                .map(TierListItemDto::from)
                .toList();
        return new TierListDto(
                tierList.getId(),
                tierList.getSlug(),
                tierList.getTitulo(),
                tierList.getAnimeSlug(),
                tierList.isPublico(),
                tierList.getUsuario().getUsername(),
                tierList.getCreatedAt(),
                tierList.getUpdatedAt(),
                orderedItems);
    }
}
