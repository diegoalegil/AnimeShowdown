package com.diegoalegil.animeshowdown.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Cubre el comportamiento del checker tras el hardening P1 (2026-05-17):
 * <ul>
 *   <li>CF IPv4 e IPv6 oficiales son trusted.</li>
 *   <li>Loopback v4/v6 trusted.</li>
 *   <li>RFC1918 NO trusted por default (cierre de vector spoof).</li>
 *   <li>RFC1918 trusted SOLO si se activa la flag explícita.</li>
 *   <li>IP pública random rechazada.</li>
 *   <li>IP malformada rechazada (no lanza).</li>
 * </ul>
 */
class TrustedProxyCheckerTest {

    @Test
    void cloudflareIpv4EsTrusted() {
        var checker = new TrustedProxyChecker(false);
        assertThat(checker.isTrusted("173.245.49.10")).isTrue();
        assertThat(checker.isTrusted("104.16.132.229")).isTrue();
        assertThat(checker.isTrusted("172.64.0.1")).isTrue();
    }

    @Test
    void cloudflareIpv6EsTrusted() {
        var checker = new TrustedProxyChecker(false);
        assertThat(checker.isTrusted("2400:cb00::1")).isTrue();
        assertThat(checker.isTrusted("2606:4700:4700::1111")).isTrue();
        assertThat(checker.isTrusted("2a06:98c0:3600::1")).isTrue();
    }

    @Test
    void loopbackEsTrustedEnAmbasFamilias() {
        var checker = new TrustedProxyChecker(false);
        assertThat(checker.isTrusted("127.0.0.1")).isTrue();
        assertThat(checker.isTrusted("::1")).isTrue();
    }

    @Test
    void rfc1918NoEsTrustedPorDefault() {
        var checker = new TrustedProxyChecker(false);
        assertThat(checker.isTrusted("10.0.0.1")).isFalse();
        assertThat(checker.isTrusted("172.16.5.5")).isFalse();
        assertThat(checker.isTrusted("192.168.1.100")).isFalse();
    }

    @Test
    void rfc1918EsTrustedSoloConFlagExplicita() {
        var checker = new TrustedProxyChecker(true);
        assertThat(checker.isTrusted("10.0.0.1")).isTrue();
        assertThat(checker.isTrusted("172.16.5.5")).isTrue();
        assertThat(checker.isTrusted("192.168.1.100")).isTrue();
    }

    @Test
    void ipPublicaRandomNoEsTrusted() {
        var checker = new TrustedProxyChecker(true);
        // 8.8.8.8 Google DNS, 1.1.1.1 es de CF pero no en sus rangos de proxy.
        assertThat(checker.isTrusted("8.8.8.8")).isFalse();
        assertThat(checker.isTrusted("1.1.1.1")).isFalse();
        assertThat(checker.isTrusted("2001:4860:4860::8888")).isFalse();
    }

    @Test
    void ipMalformadaNoLanza() {
        var checker = new TrustedProxyChecker(false);
        assertThat(checker.isTrusted(null)).isFalse();
        assertThat(checker.isTrusted("")).isFalse();
        assertThat(checker.isTrusted("not-an-ip")).isFalse();
        assertThat(checker.isTrusted("999.999.999.999")).isFalse();
    }
}
