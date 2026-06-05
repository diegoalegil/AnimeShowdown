package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.diegoalegil.animeshowdown.repository.TorneoRepository;

@ExtendWith(MockitoExtension.class)
class TorneoAutoAdvanceJobTest {

    @Mock private TorneoRepository torneoRepository;
    @Mock private TorneoAutoAdvanceService torneoAutoAdvanceService;

    @Test
    void avanzaCadaTorneoEnCursoConOrigenScheduler() {
        when(torneoRepository.findIdsEnCurso()).thenReturn(List.of(1L, 2L, 3L));
        TorneoAutoAdvanceJob job = new TorneoAutoAdvanceJob(torneoRepository, torneoAutoAdvanceService);

        job.avanzarTorneosEnCurso();

        verify(torneoAutoAdvanceService).avanzarSiProcede(1L, "scheduler");
        verify(torneoAutoAdvanceService).avanzarSiProcede(2L, "scheduler");
        verify(torneoAutoAdvanceService).avanzarSiProcede(3L, "scheduler");
    }

    @Test
    void unTorneoQueFallaNoDetieneLosDemas() {
        when(torneoRepository.findIdsEnCurso()).thenReturn(List.of(1L, 2L));
        doThrow(new RuntimeException("torneo corrupto"))
                .when(torneoAutoAdvanceService).avanzarSiProcede(1L, "scheduler");
        TorneoAutoAdvanceJob job = new TorneoAutoAdvanceJob(torneoRepository, torneoAutoAdvanceService);

        assertThatNoException().isThrownBy(job::avanzarTorneosEnCurso);

        // el segundo se procesa pese al fallo del primero
        verify(torneoAutoAdvanceService).avanzarSiProcede(2L, "scheduler");
    }
}
