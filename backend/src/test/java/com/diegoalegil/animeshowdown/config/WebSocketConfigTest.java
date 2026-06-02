package com.diegoalegil.animeshowdown.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class WebSocketConfigTest {

    @Test
    void reservaTopicsPublicosDeDueloLiveParaEvitarFugaDeEstadoPrivado() {
        assertThat(WebSocketConfig.isDueloLivePublicStateDestination("/topic/duelo/123/state")).isTrue();
        assertThat(WebSocketConfig.isDueloLivePublicStateDestination("/topic/torneo.123.bracket")).isFalse();
        assertThat(WebSocketConfig.isDueloLivePublicStateDestination("/user/queue/duelo")).isFalse();
        assertThat(WebSocketConfig.isDueloLivePublicStateDestination(null)).isFalse();
    }
}
