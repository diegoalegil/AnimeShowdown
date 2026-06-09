package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class FantasyShowdownWeeklyJobTest {

    private static final Clock FIXED_CLOCK =
            Clock.fixed(Instant.parse("2026-06-09T00:05:00Z"), ZoneOffset.UTC);

    @Mock private FantasyShowdownService fantasyShowdownService;
    @Mock private JobLockService jobLock;

    @Test
    void sinLockNoCierraNiBloquea() {
        when(jobLock.intentarAdquirir(eq("fantasy_weekly"), any())).thenReturn(false);
        FantasyShowdownWeeklyJob job = new FantasyShowdownWeeklyJob(
                fantasyShowdownService, jobLock, FIXED_CLOCK);

        job.cerrarYBloquearSemana();

        verify(fantasyShowdownService, never()).cerrarSemana(any());
        verify(fantasyShowdownService, never()).bloquearEquiposSemana(any());
    }

    @Test
    void conLockCierraSemanaAnteriorYBloqueaActual() {
        when(jobLock.intentarAdquirir(eq("fantasy_weekly"), any())).thenReturn(true);
        FantasyShowdownWeeklyJob job = new FantasyShowdownWeeklyJob(
                fantasyShowdownService, jobLock, FIXED_CLOCK);

        job.cerrarYBloquearSemana();

        verify(fantasyShowdownService).cerrarSemana("2026-W23");
        verify(fantasyShowdownService).bloquearEquiposSemana("2026-W24");
    }

    @Test
    void falloDeCierreNoPropagaNiBloqueaLaSemanaNueva() {
        when(jobLock.intentarAdquirir(eq("fantasy_weekly"), any())).thenReturn(true);
        doThrow(new RuntimeException("ranking no disponible"))
                .when(fantasyShowdownService).cerrarSemana("2026-W23");
        FantasyShowdownWeeklyJob job = new FantasyShowdownWeeklyJob(
                fantasyShowdownService, jobLock, FIXED_CLOCK);

        assertThatNoException().isThrownBy(job::cerrarYBloquearSemana);

        verify(fantasyShowdownService).cerrarSemana("2026-W23");
        verify(fantasyShowdownService, never()).bloquearEquiposSemana(any());
    }
}
