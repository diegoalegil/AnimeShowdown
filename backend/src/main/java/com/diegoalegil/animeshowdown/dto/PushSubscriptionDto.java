package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;

import com.diegoalegil.animeshowdown.model.PushSubscription;

public record PushSubscriptionDto(
        Long id,
        String endpoint,
        LocalDateTime createdAt) {

    public static PushSubscriptionDto from(PushSubscription sub) {
        return new PushSubscriptionDto(sub.getId(), sub.getEndpoint(), sub.getCreatedAt());
    }
}
