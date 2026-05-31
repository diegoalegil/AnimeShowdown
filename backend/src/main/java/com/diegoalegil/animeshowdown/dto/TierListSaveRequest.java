package com.diegoalegil.animeshowdown.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

public record TierListSaveRequest(
        @Size(max = 120, message = "El título no puede superar 120 caracteres")
        String titulo,
        @Size(max = 120, message = "El slug de anime no puede superar 120 caracteres")
        String animeSlug,
        Boolean publico,
        List<@Valid TierListItemRequest> items) {
}
