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
class StatsReconciliacionJobTest {

    @Mock private StatsReconciliacionService service;
    @Mock private JobLockService jobLock;

    @Test
    void sinLockNoReconcilia() {
        when(jobLock.intentarAdquirir(eq("reconciliacion_stats"), any())).thenReturn(false);
        StatsReconciliacionJob job = new StatsReconciliacionJob(service, jobLock);

        job.reconciliar();

        verify(service, never()).reconciliar();
    }

    @Test
    void conLockReconcilia() {
        when(jobLock.intentarAdquirir(eq("reconciliacion_stats"), any())).thenReturn(true);
        StatsReconciliacionJob job = new StatsReconciliacionJob(service, jobLock);

        job.reconciliar();

        verify(service).reconciliar();
    }

    @Test
    void unFalloEnLaReconciliacionNoPropaga() {
        when(jobLock.intentarAdquirir(eq("reconciliacion_stats"), any())).thenReturn(true);
        doThrow(new RuntimeException("db caida")).when(service).reconciliar();
        StatsReconciliacionJob job = new StatsReconciliacionJob(service, jobLock);

        assertThatNoException().isThrownBy(job::reconciliar);
        verify(service).reconciliar();
    }
}
