package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;

import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.service.EloSemillaInitializeService.DatoAnilist;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Cubre la lógica de {@code aplicar}: rellenar género/popularidad si están
 * vacíos (sin pisar correcciones manuales) y recalcular la semilla. La carga del
 * JSON y la persistencia se ejercitan en el arranque real; aquí va la decisión.
 */
class EloSemillaInitializeServiceTest {

    private static final EloSemillaCalculator.Params PARAMS =
            new EloSemillaCalculator.Params(120, 1500, 1900, 1.15);

    private final EloSemillaInitializeService service = new EloSemillaInitializeService(
            mock(PersonajeRepository.class), new ObjectMapper(), 120, 1500, 1900, 1.15);

    private static Personaje personaje() {
        return new Personaje("x", "X", "Anime", "desc", "/img/x.webp");
    }

    @Test
    void rellenaGeneroPopularidadYCalculaSemillaCuandoEstanVacios() {
        Personaje p = personaje();
        boolean dirty = service.aplicar(p, new DatoAnilist("F", 100, "X", true));

        assertThat(dirty).isTrue();
        assertThat(p.getGenero()).isEqualTo("F");
        assertThat(p.getPopularidadFuente()).isEqualTo(100);
        assertThat(p.getEloSemilla()).isEqualTo(EloSemillaCalculator.calcular(100, "F", PARAMS));
    }

    @Test
    void noPisaGeneroNiPopularidadYaPresentes() {
        Personaje p = personaje();
        p.setGenero("M");
        p.setPopularidadFuente(50);

        service.aplicar(p, new DatoAnilist("F", 9999, "X", true));

        assertThat(p.getGenero()).isEqualTo("M"); // conserva la corrección manual
        assertThat(p.getPopularidadFuente()).isEqualTo(50);
        assertThat(p.getEloSemilla()).isEqualTo(EloSemillaCalculator.calcular(50, "M", PARAMS));
    }

    @Test
    void sinPopularidadLaSemillaEsNull() {
        Personaje p = personaje();
        boolean dirty = service.aplicar(p, new DatoAnilist(null, null, null, false));

        // sin datos ni en p ni en AniList → semilla null (cold-start, suelo)
        assertThat(dirty).isFalse(); // ya era null
        assertThat(p.getEloSemilla()).isNull();
    }

    @Test
    void datoNuloRecalculaSemillaDesdeLoQueYaTiene() {
        Personaje p = personaje();
        p.setPopularidadFuente(200);

        boolean dirty = service.aplicar(p, null);

        assertThat(dirty).isTrue();
        assertThat(p.getEloSemilla()).isEqualTo(EloSemillaCalculator.calcular(200, null, PARAMS));
    }

    @Test
    void esIdempotenteSiNadaCambia() {
        Personaje p = personaje();
        p.setGenero("F");
        p.setPopularidadFuente(100);
        p.setEloSemilla(EloSemillaCalculator.calcular(100, "F", PARAMS));

        assertThat(service.aplicar(p, new DatoAnilist("F", 100, "X", true))).isFalse();
    }
}
