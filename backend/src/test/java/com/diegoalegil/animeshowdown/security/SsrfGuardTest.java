package com.diegoalegil.animeshowdown.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SsrfGuardTest {

    @Test
    void rechazaLoopbackPrivadasLinkLocalYMetadata() {
        assertThat(SsrfGuard.isFetchAllowed("http://127.0.0.1/x")).isFalse();
        assertThat(SsrfGuard.isFetchAllowed("http://127.1.2.3/x")).isFalse();
        assertThat(SsrfGuard.isFetchAllowed("http://169.254.169.254/latest/meta-data/")).isFalse();
        assertThat(SsrfGuard.isFetchAllowed("http://10.0.0.5/x")).isFalse();
        assertThat(SsrfGuard.isFetchAllowed("http://172.16.0.1/x")).isFalse();
        assertThat(SsrfGuard.isFetchAllowed("http://192.168.1.1/x")).isFalse();
        assertThat(SsrfGuard.isFetchAllowed("http://0.0.0.0/x")).isFalse();
        assertThat(SsrfGuard.isFetchAllowed("https://[::1]/x")).isFalse();
        assertThat(SsrfGuard.isFetchAllowed("https://[fd00::1]/x")).isFalse(); // ULA fc00::/7
    }

    @Test
    void rechazaEsquemasNoHttpYBasura() {
        assertThat(SsrfGuard.isFetchAllowed("ftp://1.1.1.1/x")).isFalse();
        assertThat(SsrfGuard.isFetchAllowed("file:///etc/passwd")).isFalse();
        assertThat(SsrfGuard.isFetchAllowed("gopher://1.1.1.1/")).isFalse();
        assertThat(SsrfGuard.isFetchAllowed("no-soy-una-url")).isFalse();
        assertThat(SsrfGuard.isFetchAllowed(null)).isFalse();
        assertThat(SsrfGuard.isFetchAllowed("")).isFalse();
    }

    @Test
    void permiteIpPublicaLiteral() {
        // IPs públicas literales no requieren DNS → test offline determinista.
        assertThat(SsrfGuard.isFetchAllowed("https://1.1.1.1/img.png")).isTrue();
        assertThat(SsrfGuard.isFetchAllowed("http://8.8.8.8/img.png")).isTrue();
    }

    @Test
    void bloqueaIpLiteralInternaEnInputSinDns() {
        assertThat(SsrfGuard.isBlockedLiteralHost("127.0.0.1")).isTrue();
        assertThat(SsrfGuard.isBlockedLiteralHost("169.254.169.254")).isTrue();
        assertThat(SsrfGuard.isBlockedLiteralHost("10.1.2.3")).isTrue();
        assertThat(SsrfGuard.isBlockedLiteralHost("192.168.0.1")).isTrue();
        assertThat(SsrfGuard.isBlockedLiteralHost("::1")).isTrue();
        assertThat(SsrfGuard.isBlockedLiteralHost("8.8.8.8")).isFalse();          // pública
        assertThat(SsrfGuard.isBlockedLiteralHost("animeshowdown.dev")).isFalse(); // hostname → sin DNS aquí
    }
}
