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
class AlertaFavoritoMovimientoJobTest {

    @Mock private AlertaFavoritoMovimientoService service;
    @Mock private JobLockService jobLock;

    @Test
    void sinLockNoNotifica() {
        when(jobLock.intentarAdquirir(eq("alerta_favorito"), any())).thenReturn(false);
        AlertaFavoritoMovimientoJob job = new AlertaFavoritoMovimientoJob(service, jobLock);

        job.notificarMovimientos();

        verify(service, never()).notificarMovimientos();
    }

    @Test
    void conLockNotifica() {
        when(jobLock.intentarAdquirir(eq("alerta_favorito"), any())).thenReturn(true);
        when(service.notificarMovimientos()).thenReturn(3);
        AlertaFavoritoMovimientoJob job = new AlertaFavoritoMovimientoJob(service, jobLock);

        job.notificarMovimientos();

        verify(service).notificarMovimientos();
    }

    @Test
    void unFalloEnElFanOutNoPropaga() {
        when(jobLock.intentarAdquirir(eq("alerta_favorito"), any())).thenReturn(true);
        doThrow(new RuntimeException("smtp caido")).when(service).notificarMovimientos();
        AlertaFavoritoMovimientoJob job = new AlertaFavoritoMovimientoJob(service, jobLock);

        assertThatNoException().isThrownBy(job::notificarMovimientos);
        verify(service).notificarMovimientos();
    }
}
