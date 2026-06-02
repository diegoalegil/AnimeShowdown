package com.diegoalegil.animeshowdown.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class WebPushEndpointGuardTest {

    private final WebPushEndpointGuard guard =
            new WebPushEndpointGuard(WebPushEndpointGuard.DEFAULT_ALLOWED_HOSTS);

    @Test
    void aceptaProveedoresWebPushConocidos() {
        assertThat(guard.isAllowed("https://fcm.googleapis.com/fcm/send/abc123")).isTrue();
        assertThat(guard.isAllowed("https://updates.push.services.mozilla.com/wpush/v2/abc123")).isTrue();
        assertThat(guard.isAllowed("https://webpush.push.apple.com/Q/abc123")).isTrue();
        assertThat(guard.isAllowed("https://wns2-par02p.notify.windows.com/w/?token=abc123")).isTrue();
    }

    @Test
    void rechazaHttpPuertosCredencialesYFragmentos() {
        assertThat(guard.isAllowed("http://fcm.googleapis.com/fcm/send/abc123")).isFalse();
        assertThat(guard.isAllowed("https://fcm.googleapis.com:8443/fcm/send/abc123")).isFalse();
        assertThat(guard.isAllowed("https://user:pass@fcm.googleapis.com/fcm/send/abc123")).isFalse();
        assertThat(guard.isAllowed("https://fcm.googleapis.com/fcm/send/abc123#token")).isFalse();
    }

    @Test
    void rechazaHostsNoAllowlistedEIpPrivadaLiteral() {
        assertThat(guard.isAllowed("https://fcm.googleapis.com.evil.example/fcm/send/abc123")).isFalse();
        assertThat(guard.isAllowed("https://127.0.0.1/fcm/send/abc123")).isFalse();
        assertThat(guard.isAllowed("https://169.254.169.254/latest/meta-data")).isFalse();
        assertThat(guard.isAllowed("https://[::1]/wpush/v2/abc123")).isFalse();
    }

    @Test
    void requireAllowedDevuelveEndpointTrimadoO400() {
        assertThat(guard.requireAllowed("  https://fcm.googleapis.com/fcm/send/abc123  "))
                .isEqualTo("https://fcm.googleapis.com/fcm/send/abc123");

        assertThatThrownBy(() -> guard.requireAllowed("https://example.com/push/abc123"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400 BAD_REQUEST");
    }
}
