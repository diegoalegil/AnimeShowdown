package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.diegoalegil.animeshowdown.event.EnfrentamientoVotadoEvent;

@ExtendWith(MockitoExtension.class)
class TorneoAutoAdvanceListenerTest {

    @Mock private TorneoAutoAdvanceService torneoAutoAdvanceService;

    @Test
    void avanzaTrasVotoConOrigenVote() {
        TorneoAutoAdvanceListener listener = new TorneoAutoAdvanceListener(torneoAutoAdvanceService);

        listener.onVoto(new EnfrentamientoVotadoEvent(5L, 99L));

        verify(torneoAutoAdvanceService).avanzarSiProcede(5L, "vote");
    }

    @Test
    void unFalloEnElAvanceNoPropaga() {
        doThrow(new RuntimeException("torneo corrupto"))
                .when(torneoAutoAdvanceService).avanzarSiProcede(5L, "vote");
        TorneoAutoAdvanceListener listener = new TorneoAutoAdvanceListener(torneoAutoAdvanceService);

        assertThatNoException()
                .isThrownBy(() -> listener.onVoto(new EnfrentamientoVotadoEvent(5L, 99L)));
    }
}
