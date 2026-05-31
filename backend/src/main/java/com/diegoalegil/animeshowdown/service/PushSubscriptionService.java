package com.diegoalegil.animeshowdown.service;

import java.time.LocalDateTime;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.PushSubscribeRequest;
import com.diegoalegil.animeshowdown.dto.PushSubscriptionDto;
import com.diegoalegil.animeshowdown.model.PushSubscription;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.PushSubscriptionRepository;

@Service
public class PushSubscriptionService {

    private final PushSubscriptionRepository repository;
    private final WebPushService webPushService;

    public PushSubscriptionService(PushSubscriptionRepository repository,
            WebPushService webPushService) {
        this.repository = repository;
        this.webPushService = webPushService;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> publicKeyInfo() {
        return Map.of(
                "enabled", webPushService.isEnabled(),
                "publicKey", webPushService.publicKey());
    }

    @Transactional
    public PushSubscriptionDto subscribe(Usuario usuario, PushSubscribeRequest request) {
        PushSubscription sub = repository.findByEndpoint(request.endpoint())
                .orElseGet(PushSubscription::new);
        sub.setUsuario(usuario);
        sub.setEndpoint(request.endpoint());
        sub.setP256dh(request.keys().p256dh());
        sub.setAuth(request.keys().auth());
        if (sub.getCreatedAt() == null) {
            sub.setCreatedAt(LocalDateTime.now());
        }
        return PushSubscriptionDto.from(repository.save(sub));
    }

    @Transactional
    public int unsubscribe(Usuario usuario, String endpoint) {
        if (endpoint == null || endpoint.isBlank()) {
            return repository.deleteByUsuario(usuario);
        }
        return repository.deleteByUsuarioAndEndpoint(usuario, endpoint.trim());
    }
}
