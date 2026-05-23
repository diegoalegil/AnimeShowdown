package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.diegoalegil.animeshowdown.model.Usuario;

class PvpEloServiceTest {

    private final PvpEloService service = new PvpEloService();

    @Test
    void limitaDeltaContraFallbackParaEvitarFarmeo() {
        Usuario jugador = usuario("pvp_fallback_win", 1000);

        PvpEloService.PvpEloResult result = service.aplicarResultado(jugador, null, 1.0, false);

        assertThat(result.jugador1Delta()).isBetween(-4, 4);
        assertThat(result.jugador1Delta()).isEqualTo(4);
        assertThat(jugador.getEloPvp()).isEqualTo(1004);
    }

    @Test
    void limitaPenalizacionContraFallback() {
        Usuario jugador = usuario("pvp_fallback_loss", 1000);

        PvpEloService.PvpEloResult result = service.aplicarResultado(jugador, null, 0.0, false);

        assertThat(result.jugador1Delta()).isBetween(-4, 4);
        assertThat(result.jugador1Delta()).isEqualTo(-4);
        assertThat(jugador.getEloPvp()).isEqualTo(996);
    }

    private static Usuario usuario(String username, int eloPvp) {
        Usuario usuario = new Usuario(username, "{noop}secreta123", username + "@example.com");
        usuario.setEloPvp(eloPvp);
        return usuario;
    }
}
