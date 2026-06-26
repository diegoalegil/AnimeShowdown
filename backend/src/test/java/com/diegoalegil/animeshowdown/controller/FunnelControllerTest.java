package com.diegoalegil.animeshowdown.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.http.HttpStatus;

import com.diegoalegil.animeshowdown.service.AnimeShowdownMetrics;

@ExtendWith(MockitoExtension.class)
class FunnelControllerTest {

    @Mock private AnimeShowdownMetrics metrics;
    @InjectMocks private FunnelController controller;

    @Test
    void eventoEnWhitelistIncrementaElContadorYDevuelve204() {
        var resp = controller.evento("vote_wall_hit");
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(metrics).clientEvent("vote_wall_hit");
    }

    @Test
    void eventoFueraDelWhitelistSeIgnoraSinContarPeroDevuelve204() {
        // Cardinalidad acotada: un nombre arbitrario NO debe crear una serie nueva.
        var resp = controller.evento("hacker_event_xyz");
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verifyNoInteractions(metrics);
    }

    @Test
    void eventoNuloOVacioNoRevientaYDevuelve204() {
        assertThat(controller.evento(null).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(controller.evento("").getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verifyNoInteractions(metrics);
    }
}
