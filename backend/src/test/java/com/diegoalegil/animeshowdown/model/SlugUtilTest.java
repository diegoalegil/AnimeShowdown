package com.diegoalegil.animeshowdown.model;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class SlugUtilTest {

    @Test
    void devuelveSinTituloParaTextoVacioONulo() {
        assertEquals("sin-titulo", SlugUtil.slugify(null));
        assertEquals("sin-titulo", SlugUtil.slugify("   "));
    }

    @Test
    void normalizaDiacriticosSignosYEspacios() {
        assertEquals(
                "sosuke-aizen-rey-de-hueco-mundo",
                SlugUtil.slugify("  Sosuke Aizen: ¡Rey de Hueco Mundo!  "));
    }

    @Test
    void recortaAlLimiteDeColumna() {
        assertEquals(80, SlugUtil.slugify("a".repeat(100)).length());
    }
}
