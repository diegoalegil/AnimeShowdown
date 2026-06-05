package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.diegoalegil.animeshowdown.event.VotoAgregadoEvent;

@ExtendWith(MockitoExtension.class)
class VotoAgregadoStatsListenerTest {

    @Mock private VotoStatsService votoStatsService;

    @Test
    void materializaLosAgregadosConLosDatosDelEvento() {
        List<VotoAgregadoEvent.DiaDelta> deltas = List.of();
        LocalDate dia = LocalDate.of(2026, 6, 5);
        VotoAgregadoStatsListener listener = new VotoAgregadoStatsListener(votoStatsService);

        listener.onVoto(new VotoAgregadoEvent(deltas, dia, 7L));

        verify(votoStatsService).registrarAgregadosDiarios(deltas, dia, 7L);
    }

    @Test
    void unFalloEnLaMaterializacionNoPropaga() {
        doThrow(new RuntimeException("db caida"))
                .when(votoStatsService).registrarAgregadosDiarios(any(), any(), any());
        VotoAgregadoStatsListener listener = new VotoAgregadoStatsListener(votoStatsService);

        assertThatNoException().isThrownBy(() ->
                listener.onVoto(new VotoAgregadoEvent(List.of(), LocalDate.of(2026, 6, 5), null)));
    }
}
