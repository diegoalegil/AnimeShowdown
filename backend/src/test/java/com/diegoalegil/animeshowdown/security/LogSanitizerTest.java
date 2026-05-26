package com.diegoalegil.animeshowdown.security;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class LogSanitizerTest {

    @Test
    void emailEnmascaraLocalPartYDominioConservandoTld() {
        assertEquals("d***@e***.com", LogSanitizer.email("  diego@example.com  "));
    }

    @Test
    void emailVacioONullNoFiltraEntrada() {
        assertEquals("<empty>", LogSanitizer.email(null));
        assertEquals("<empty>", LogSanitizer.email("   "));
    }

    @Test
    void identifierMantieneUsernameYEnmascaraEmail() {
        assertEquals("diego", LogSanitizer.identifier("diego"));
        assertEquals("d***@e***.com", LogSanitizer.identifier("diego@example.com"));
    }

    @Test
    void emailSinFormatoValidoSeEnmascaraCompleto() {
        assertEquals("n***", LogSanitizer.email("not-an-email"));
        assertEquals("*", LogSanitizer.email("x"));
    }
}
