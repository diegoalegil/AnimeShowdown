package com.diegoalegil.animeshowdown.service;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.diegoalegil.animeshowdown.event.UsuarioRegistradoEvent;

@ExtendWith(MockitoExtension.class)
class FunnelMetricsListenerTest {

    @Mock private AnimeShowdownMetrics metrics;
    @InjectMocks private FunnelMetricsListener listener;

    @Test
    void cuentaElRegistroAlRecibirElEvento() {
        listener.onUsuarioRegistrado(new UsuarioRegistradoEvent(42L));
        verify(metrics).registroCompletado();
    }

    @Test
    void noCuentaSiElEventoOIdEsNulo() {
        listener.onUsuarioRegistrado(new UsuarioRegistradoEvent(null));
        listener.onUsuarioRegistrado(null);
        verifyNoInteractions(metrics);
    }
}
