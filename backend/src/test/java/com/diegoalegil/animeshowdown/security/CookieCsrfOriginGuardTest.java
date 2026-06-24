package com.diegoalegil.animeshowdown.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Guard de CSRF por Origin/Referer para las peticiones que mutan cookies
 * httpOnly (refresh/logout). Sin test, un fallo de parsing o un Origin vacío
 * podría dejar pasar un origen falsificado. Fija el contrato de
 * {@code isAllowed}/{@code sourceOrigin}.
 */
class CookieCsrfOriginGuardTest {

    // Allowlist de un solo origen de confianza; sin patrones.
    private final CookieCsrfOriginGuard guard =
            new CookieCsrfOriginGuard("http://localhost:5173", "");

    private HttpServletRequest req(String origin, String referer) {
        HttpServletRequest r = mock(HttpServletRequest.class);
        when(r.getHeader("Origin")).thenReturn(origin);
        when(r.getHeader("Referer")).thenReturn(referer);
        return r;
    }

    @Test
    void permiteOriginEnLaAllowlist() {
        assertThat(guard.isAllowed(req("http://localhost:5173", null))).isTrue();
    }

    @Test
    void rechazaOriginForaneo() {
        assertThat(guard.isAllowed(req("http://evil.com", null))).isFalse();
    }

    @Test
    void rechazaSinOriginNiReferer() {
        assertThat(guard.isAllowed(req(null, null))).isFalse();
    }

    @Test
    void originEnBlancoSeTrataComoAusente() {
        // "   " → clean() lo vuelve null → cae a Referer (también null) → no permitido.
        assertThat(guard.isAllowed(req("   ", null))).isFalse();
    }

    @Test
    void caeAlRefererYNormalizaEsquemaHostPuerto() {
        // Sin Origin, el Referer con path/query se normaliza a scheme://host:port.
        assertThat(guard.isAllowed(req(null, "http://localhost:5173/votar?x=1"))).isTrue();
        assertThat(guard.sourceOrigin(req(null, "http://localhost:5173/votar?x=1")))
                .isEqualTo("http://localhost:5173");
    }

    @Test
    void rechazaRefererForaneoNormalizado() {
        assertThat(guard.isAllowed(req(null, "http://evil.com:8080/x"))).isFalse();
    }

    @Test
    void refererMalformadoDevuelveNull() {
        // URI.create lanza IllegalArgumentException (espacio en el host) → null.
        assertThat(guard.sourceOrigin(req(null, "http://exa mple.com/x"))).isNull();
        assertThat(guard.isAllowed(req(null, "http://exa mple.com/x"))).isFalse();
    }

    @Test
    void refererSinEsquemaOHostDevuelveNull() {
        assertThat(guard.sourceOrigin(req(null, "/ruta-relativa"))).isNull();
    }

    @Test
    void originTienePrecedenciaSobreReferer() {
        // Origin foráneo + Referer permitido → manda el Origin → rechazado.
        assertThat(guard.isAllowed(req("http://evil.com", "http://localhost:5173/x"))).isFalse();
        // Origin permitido se devuelve tal cual, sin mirar el Referer.
        assertThat(guard.sourceOrigin(req("http://localhost:5173", "http://evil.com/x")))
                .isEqualTo("http://localhost:5173");
    }

    @Test
    void requestNuloEsNull() {
        assertThat(guard.sourceOrigin(null)).isNull();
    }
}
