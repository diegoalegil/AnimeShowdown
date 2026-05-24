package com.diegoalegil.animeshowdown.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseCookie;

/**
 * cubre emit/verify del servicio de
 * identidad anónima. Unitario puro — sin Spring, sin BBDD.
 */
class AnonymousIdentityServiceTest {

    private static final String HMAC_KEY =
            "key-de-test-suficientemente-larga-para-hmac-sha256-32-bytes-min";
    private static final String COOKIE_NAME = "as_anon";

    private AnonymousIdentityService newService() {
        return new AnonymousIdentityService(HMAC_KEY, COOKIE_NAME, 30);
    }

    @Test
    void emitYVerifyRoundtripDevuelveElIdentificadorOriginal() {
        AnonymousIdentityService svc = newService();
        String token = svc.emit();
        Optional<String> identity = svc.verify(token);
        assertTrue(identity.isPresent(), "Token recién emitido debe verificarse OK");
        // El identifier es el componente antes del '.' del token serializado.
        String expectedRandom = token.substring(0, token.indexOf('.'));
        assertEquals(expectedRandom, identity.get());
    }

    @Test
    void emitGeneraTokensDistintosEntreLlamadas() {
        AnonymousIdentityService svc = newService();
        String t1 = svc.emit();
        String t2 = svc.emit();
        assertNotEquals(t1, t2, "Cada emit debe generar entropía nueva");
    }

    @Test
    void verifyRechazaTokenSinSeparador() {
        AnonymousIdentityService svc = newService();
        assertTrue(svc.verify("sin_separador").isEmpty());
    }

    @Test
    void verifyRechazaTokenVacioONull() {
        AnonymousIdentityService svc = newService();
        assertTrue(svc.verify(null).isEmpty());
        assertTrue(svc.verify("").isEmpty());
        assertTrue(svc.verify("   ").isEmpty());
    }

    @Test
    void verifyRechazaTokenConFirmaManipulada() {
        AnonymousIdentityService svc = newService();
        String token = svc.emit();
        int sep = token.indexOf('.');
        // Cambiamos un char de la parte HMAC; el constant-time compare debe
        // detectarlo y rechazar el token.
        char origChar = token.charAt(sep + 1);
        char fakeChar = origChar == 'A' ? 'B' : 'A';
        String tampered = token.substring(0, sep + 1) + fakeChar + token.substring(sep + 2);
        assertTrue(svc.verify(tampered).isEmpty(),
                "Cualquier byte modificado del HMAC debe invalidar el token");
    }

    @Test
    void verifyRechazaTokenFirmadoConOtraClave() {
        AnonymousIdentityService keyA = newService();
        AnonymousIdentityService keyB = new AnonymousIdentityService(
                "clave-distinta-pero-tambien-suficientemente-larga-para-hmac", COOKIE_NAME, 30);
        String tokenA = keyA.emit();
        // El mismo random firmado con otra clave produce HMAC distinto.
        assertTrue(keyB.verify(tokenA).isEmpty(),
                "Tokens emitidos con una clave no deben verificarse con otra");
    }

    @Test
    void buildCookieTieneFlagsDeSeguridad() {
        AnonymousIdentityService svc = newService();
        String token = svc.emit();
        ResponseCookie cookie = svc.buildCookie(token);
        assertEquals(COOKIE_NAME, cookie.getName());
        assertEquals(token, cookie.getValue());
        assertTrue(cookie.isHttpOnly(), "Cookie debe ser httpOnly para evitar XSS read");
        assertTrue(cookie.isSecure(), "Cookie debe ser Secure (HTTPS only)");
        assertEquals("Lax", cookie.getSameSite());
        assertEquals("/", cookie.getPath());
        assertEquals(Duration.ofDays(30), cookie.getMaxAge());
    }

    @Test
    void constructorAbortaSiHmacKeyEstaVacia() {
        assertThrows(IllegalStateException.class,
                () -> new AnonymousIdentityService("", COOKIE_NAME, 30));
        assertThrows(IllegalStateException.class,
                () -> new AnonymousIdentityService(null, COOKIE_NAME, 30));
    }

    @Test
    void cookieTtlAceptaMinimo1DiaParaValoresInvalidos() {
        AnonymousIdentityService svc = new AnonymousIdentityService(HMAC_KEY, COOKIE_NAME, 0);
        // 0 días sería una cookie de sesión sin sentido; clamp a 1.
        assertEquals(Duration.ofDays(1), svc.getCookieTtl());
        AnonymousIdentityService svcNeg = new AnonymousIdentityService(HMAC_KEY, COOKIE_NAME, -5);
        assertEquals(Duration.ofDays(1), svcNeg.getCookieTtl());
    }

    @Test
    void getCookieNameRespetaLaPropConfig() {
        AnonymousIdentityService svc = new AnonymousIdentityService(HMAC_KEY, "custom_anon", 7);
        assertEquals("custom_anon", svc.getCookieName());
        assertNotNull(svc.emit());
    }

    @Test
    void verifyRechazaTokenConRandomManipulado() {
        AnonymousIdentityService svc = newService();
        String token = svc.emit();
        int sep = token.indexOf('.');
        // Cambiamos el primer char del random (parte previa al '.'). El
        // HMAC original ya no encaja con el nuevo random → reject.
        char origChar = token.charAt(0);
        char fakeChar = origChar == 'A' ? 'B' : 'A';
        String tampered = fakeChar + token.substring(1);
        assertFalse(svc.verify(tampered).isPresent());
    }
}
