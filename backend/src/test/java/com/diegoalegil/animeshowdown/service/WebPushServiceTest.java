package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.diegoalegil.animeshowdown.model.PushSubscription;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.security.WebPushEndpointGuard;
import com.diegoalegil.animeshowdown.service.WebPushService.WebPushPayload;
import com.fasterxml.jackson.databind.ObjectMapper;

class WebPushServiceTest {

    private final WebPushEndpointGuard guard =
            new WebPushEndpointGuard(WebPushEndpointGuard.DEFAULT_ALLOWED_HOSTS);

    @Test
    void enviarMarcaParaBorrarSuscripcionesLegacyInvalidasSinEgress() {
        WebPushService service = new WebPushService(new ObjectMapper(), "", "",
                "mailto:test@example.com", guard);
        PushSubscription subscription = subscription("https://127.0.0.1/push/token");

        var result = service.enviar(subscription, new WebPushPayload("Titulo", "Body", "/", "test"));

        assertThat(result.attempted()).isFalse();
        assertThat(result.removeSubscription()).isTrue();
    }

    @Test
    void enviarDesactivadoNoBorraSuscripcionValida() {
        WebPushService service = new WebPushService(new ObjectMapper(), "", "",
                "mailto:test@example.com", guard);
        PushSubscription subscription = subscription("https://fcm.googleapis.com/fcm/send/token");

        var result = service.enviar(subscription, new WebPushPayload("Titulo", "Body", "/", "test"));

        assertThat(result.attempted()).isFalse();
        assertThat(result.removeSubscription()).isFalse();
    }

    private static PushSubscription subscription(String endpoint) {
        return new PushSubscription(
                new Usuario("push_user", "hash", "push@example.com"),
                endpoint,
                "abcdefghijklmnop",
                "abcdefgh");
    }
}
