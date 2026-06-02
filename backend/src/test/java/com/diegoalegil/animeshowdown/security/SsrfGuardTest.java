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
    void rechazaRangosEspecialesIanaNoPublicos() {
        assertThat(SsrfGuard.isFetchAllowed("http://100.64.0.1/x")).isFalse(); // CGNAT
        assertThat(SsrfGuard.isFetchAllowed("http://192.0.0.10/x")).isFalse(); // IETF
        assertThat(SsrfGuard.isFetchAllowed("http://192.0.2.10/x")).isFalse(); // TEST-NET-1
        assertThat(SsrfGuard.isFetchAllowed("http://192.31.196.10/x")).isFalse(); // AS112-v4
        assertThat(SsrfGuard.isFetchAllowed("http://192.52.193.10/x")).isFalse(); // AMT
        assertThat(SsrfGuard.isFetchAllowed("http://192.175.48.10/x")).isFalse(); // AS112-v4
        assertThat(SsrfGuard.isFetchAllowed("http://198.18.0.1/x")).isFalse(); // benchmark
        assertThat(SsrfGuard.isFetchAllowed("http://198.51.100.2/x")).isFalse(); // TEST-NET-2
        assertThat(SsrfGuard.isFetchAllowed("http://203.0.113.5/x")).isFalse(); // TEST-NET-3
        assertThat(SsrfGuard.isFetchAllowed("http://240.0.0.1/x")).isFalse(); // reservado
        assertThat(SsrfGuard.isFetchAllowed("https://[64:ff9b::808:808]/x")).isFalse(); // NAT64
        assertThat(SsrfGuard.isFetchAllowed("https://[64:ff9b:1::808:808]/x")).isFalse(); // NAT64 local-use
        assertThat(SsrfGuard.isFetchAllowed("https://[100::1]/x")).isFalse(); // discard-only
        assertThat(SsrfGuard.isFetchAllowed("https://[100:0:0:1::1]/x")).isFalse(); // dummy prefix
        assertThat(SsrfGuard.isFetchAllowed("https://[2001:db8::1]/x")).isFalse(); // doc
        assertThat(SsrfGuard.isFetchAllowed("https://[2002:c000:0201::]/x")).isFalse(); // 6to4
        assertThat(SsrfGuard.isFetchAllowed("https://[2620:4f:8000::1]/x")).isFalse(); // AS112-v6
        assertThat(SsrfGuard.isFetchAllowed("https://[3fff::1]/x")).isFalse(); // doc
        assertThat(SsrfGuard.isFetchAllowed("https://[5f00::1]/x")).isFalse(); // SRv6
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
