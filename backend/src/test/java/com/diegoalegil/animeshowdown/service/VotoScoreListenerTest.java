package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.diegoalegil.animeshowdown.event.VotoScoreEvent;

@ExtendWith(MockitoExtension.class)
class VotoScoreListenerTest {

    @Mock private PersonajeVotoScoreService personajeVotoScoreService;

    @Test
    void materializaElScoreConLosDatosDelEvento() {
        VotoScoreListener listener = new VotoScoreListener(personajeVotoScoreService);

        listener.onVoto(new VotoScoreEvent(false, 10L, 10L, 20L));

        verify(personajeVotoScoreService).registrar(false, 10L, 10L, 20L);
    }

    @Test
    void unFalloEnLaMaterializacionNoPropaga() {
        doThrow(new RuntimeException("db caida"))
                .when(personajeVotoScoreService).registrar(anyBoolean(), any(), any(), any());
        VotoScoreListener listener = new VotoScoreListener(personajeVotoScoreService);

        assertThatNoException()
                .isThrownBy(() -> listener.onVoto(new VotoScoreEvent(true, 10L, 10L, 20L)));
    }
}
