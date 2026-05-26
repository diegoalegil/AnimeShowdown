package com.diegoalegil.animeshowdown.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class PersonajeSlugAliasesTest {

    @Test
    void canonicalDevuelveAliasHistoricoConocido() {
        assertEquals("luffy", PersonajeSlugAliases.canonical("monkey_d_luffy"));
        assertEquals("bakugo", PersonajeSlugAliases.canonical("katsuki_bakugou"));
    }

    @Test
    void canonicalMantieneSlugDesconocidoYNull() {
        assertEquals("gojo", PersonajeSlugAliases.canonical("gojo"));
        assertNull(PersonajeSlugAliases.canonical(null));
    }
}
