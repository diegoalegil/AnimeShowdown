package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ArenaJobTest {

    @Mock private ArenaService arenaService;
    @Mock private JobLockService jobLock;

    @Test
    void sinLockNoMantieneLaArena() {
        when(jobLock.intentarAdquirir(eq("arena_mantener"), any())).thenReturn(false);
        ArenaJob job = new ArenaJob(arenaService, jobLock, 60000L);

        job.mantenerArena();

        verify(arenaService, never()).mantener();
    }

    @Test
    void conLockMantieneLaArena() {
        when(jobLock.intentarAdquirir(eq("arena_mantener"), any())).thenReturn(true);
        ArenaJob job = new ArenaJob(arenaService, jobLock, 60000L);

        job.mantenerArena();

        verify(arenaService).mantener();
    }

    @Test
    void unFalloEnElMantenimientoNoPropaga() {
        when(jobLock.intentarAdquirir(eq("arena_mantener"), any())).thenReturn(true);
        doThrow(new RuntimeException("pool corrupto")).when(arenaService).mantener();
        ArenaJob job = new ArenaJob(arenaService, jobLock, 60000L);

        assertThatNoException().isThrownBy(job::mantenerArena);
        verify(arenaService).mantener();
    }
}
