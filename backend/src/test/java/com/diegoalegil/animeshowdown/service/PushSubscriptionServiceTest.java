package com.diegoalegil.animeshowdown.service;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verifyNoInteractions;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.PushSubscribeRequest;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.PushSubscriptionRepository;
import com.diegoalegil.animeshowdown.security.WebPushEndpointGuard;

@ExtendWith(MockitoExtension.class)
class PushSubscriptionServiceTest {

    @Mock private PushSubscriptionRepository repository;
    @Mock private WebPushService webPushService;
    @Mock private SocialOperationLock socialOperationLock;

    private PushSubscriptionService sut;
    private Usuario usuario;

    @BeforeEach
    void setUp() {
        sut = new PushSubscriptionService(repository, webPushService,
                socialOperationLock,
                new WebPushEndpointGuard(WebPushEndpointGuard.DEFAULT_ALLOWED_HOSTS));
        usuario = new Usuario("push_user", "hash", "push@example.com");
    }

    @Test
    void subscribeRechazaEndpointNoWebPushAntesDePersistir() {
        PushSubscribeRequest request = new PushSubscribeRequest(
                "https://127.0.0.1:8443/internal",
                new PushSubscribeRequest.Keys("abcdefghijklmnop", "abcdefgh"));

        assertThrows(ResponseStatusException.class, () -> sut.subscribe(usuario, request));

        verifyNoInteractions(repository);
    }
}
