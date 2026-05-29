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

    @Test
    void igualadosElGanadorSube16YElPerdedorBaja16() {
        Usuario j1 = usuario("pvp_a", 1000);
        Usuario j2 = usuario("pvp_b", 1000);

        PvpEloService.PvpEloResult r = service.aplicarResultado(j1, j2, 1.0, false);

        assertThat(r.jugador1Delta()).isEqualTo(16); // round(32 * (1 - 0.5))
        assertThat(r.jugador2Delta()).isEqualTo(-16);
        assertThat(j1.getEloPvp()).isEqualTo(1016);
        assertThat(j2.getEloPvp()).isEqualTo(984);
    }

    @Test
    void elFavoritoQueGanaSumaPoco() {
        Usuario favorito = usuario("pvp_fav", 1200);
        Usuario underdog = usuario("pvp_und", 1000);

        PvpEloService.PvpEloResult r = service.aplicarResultado(favorito, underdog, 1.0, false);

        assertThat(r.jugador1Delta()).isEqualTo(8); // round(32 * (1 - 0.7597))
        assertThat(favorito.getEloPvp()).isEqualTo(1208);
    }

    @Test
    void elUnderdogQueGanaSumaMucho() {
        Usuario underdog = usuario("pvp_und2", 1000);
        Usuario favorito = usuario("pvp_fav2", 1200);

        PvpEloService.PvpEloResult r = service.aplicarResultado(underdog, favorito, 1.0, false);

        assertThat(r.jugador1Delta()).isEqualTo(24); // round(32 * (1 - 0.2403))
        assertThat(underdog.getEloPvp()).isEqualTo(1024);
    }

    @Test
    void kFactorBajaA16TrasTreintaPartidos() {
        Usuario veterano = usuario("pvp_vet", 1000);
        veterano.setPvpPartidos(30); // K=16
        Usuario novato = usuario("pvp_nov", 1000); // K=32

        PvpEloService.PvpEloResult r = service.aplicarResultado(veterano, novato, 1.0, false);

        assertThat(r.jugador1Delta()).isEqualTo(8); // round(16 * 0.5)
        assertThat(r.jugador2Delta()).isEqualTo(-16); // round(32 * -0.5)
    }

    @Test
    void incrementaElContadorDePartidos() {
        Usuario j1 = usuario("pvp_c", 1000);
        Usuario j2 = usuario("pvp_d", 1000);

        service.aplicarResultado(j1, j2, 1.0, false);

        assertThat(j1.getPvpPartidos()).isEqualTo(1);
        assertThat(j2.getPvpPartidos()).isEqualTo(1);
    }

    private static Usuario usuario(String username, int eloPvp) {
        Usuario usuario = new Usuario(username, "{noop}secreta123", username + "@example.com");
        usuario.setEloPvp(eloPvp);
        return usuario;
    }
}
