package com.diegoalegil.animeshowdown.dto;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PersonajeScoreItemTest {

    @Test
    void eloEstimadoParteDeLaSemillaCanonica() {
        PersonajeScoreItem seeded = item(1824, 0.0);

        assertThat(seeded.eloEstimado()).isEqualTo(1824);
    }

    @Test
    void eloEstimadoUsaSueloSiNoHaySemillaValida() {
        assertThat(item(null, 0.0).eloEstimado()).isEqualTo(1500);
        assertThat(item(1400, 0.0).eloEstimado()).isEqualTo(1500);
    }

    @Test
    void eloEstimadoSumaSenalComunitariaLogaritmica() {
        PersonajeScoreItem sinVotos = item(1800, 0.0);
        PersonajeScoreItem conVotos = item(1800, 42.0);

        assertThat(conVotos.eloEstimado()).isGreaterThan(sinVotos.eloEstimado());
        assertThat(conVotos.eloEstimado()).isEqualTo(1932);
    }

    @Test
    void eloEstimadoNoRompeTechoCompetitivo() {
        assertThat(item(2300, 1_000_000.0).eloEstimado()).isEqualTo(2400);
    }

    private static PersonajeScoreItem item(Integer eloSemilla, Double votos) {
        return new PersonajeScoreItem(
                1L,
                "luffy",
                "Luffy",
                "One Piece",
                "/img/luffy.webp",
                "#c95b3f",
                eloSemilla,
                votos,
                0.0);
    }
}
