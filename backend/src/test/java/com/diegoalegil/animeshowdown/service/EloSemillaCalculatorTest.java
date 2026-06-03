package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.diegoalegil.animeshowdown.service.EloSemillaCalculator.Params;

/** Fórmula pura de la ELO semilla: suelo, ×1.15 femenino, clamp y sin datos. */
class EloSemillaCalculatorTest {

    @Test
    void sinDatosCaeAlSuelo() {
        assertThat(EloSemillaCalculator.calcular(null, "F")).isEqualTo(1500);
        assertThat(EloSemillaCalculator.calcular(0, "M")).isEqualTo(1500);
        assertThat(EloSemillaCalculator.calcular(-5, "F")).isEqualTo(1500);
    }

    @Test
    void popularidadSubeLaSemillaSobreElSuelo() {
        assertThat(EloSemillaCalculator.calcular(500, "M")).isEqualTo(1824);
        assertThat(EloSemillaCalculator.calcular(2000, "M")).isEqualTo(1896);
    }

    @Test
    void bonusFemeninoSoloAplicaAEfe() {
        // ×1.15 solo si genero == F; M/O/desconocido/null sin bonus.
        assertThat(EloSemillaCalculator.calcular(500, "F")).isEqualTo(1831);
        assertThat(EloSemillaCalculator.calcular(500, "M")).isEqualTo(1824);
        assertThat(EloSemillaCalculator.calcular(500, "O")).isEqualTo(1824);
        assertThat(EloSemillaCalculator.calcular(500, null)).isEqualTo(1824);
        // En la franja media, una F queda por delante de una M con los mismos favourites.
        assertThat(EloSemillaCalculator.calcular(500, "F"))
                .isGreaterThan(EloSemillaCalculator.calcular(500, "M"));
    }

    @Test
    void clampAlTechoEnLosMegapopulares() {
        // El techo 1900 hace que el bonus NO infle a los megapopulares (topan igual).
        assertThat(EloSemillaCalculator.calcular(50_000, "M")).isEqualTo(1900);
        assertThat(EloSemillaCalculator.calcular(50_000, "F")).isEqualTo(1900);
        assertThat(EloSemillaCalculator.calcular(2000, "F")).isEqualTo(1900); // 1903 → clamp
    }

    @Test
    void parametrosSonTunables() {
        // Subir el techo deja respirar a los populares; factor 0 = todo al suelo.
        Params techoAlto = new Params(120.0, 1500, 3000, 1.15);
        assertThat(EloSemillaCalculator.calcular(50_000, "M", techoAlto)).isGreaterThan(1900);
        Params sinCurva = new Params(0.0, 1500, 1900, 1.15);
        assertThat(EloSemillaCalculator.calcular(50_000, "F", sinCurva)).isEqualTo(1500);
    }
}
