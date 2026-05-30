package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.diegoalegil.animeshowdown.model.NotificacionTipo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.SeguidorRepository;

/**
 * Tests del fan-out de notificaciones a seguidores (B7 §3).
 */
class SeguidorFanOutServiceTest {

    private SeguidorRepository seguidorRepository;
    private NotificacionService notificacionService;
    private SeguidorFanOutService service;

    @BeforeEach
    void setUp() {
        seguidorRepository = mock(SeguidorRepository.class);
        notificacionService = mock(NotificacionService.class);
        service = new SeguidorFanOutService(seguidorRepository, notificacionService);
    }

    private static Usuario usuario(String username) {
        return new Usuario(username, "x", username + "@example.com");
    }

    @Test
    void notificaACadaSeguidor() {
        Usuario actor = usuario("actor");
        when(seguidorRepository.seguidoresDe(actor))
                .thenReturn(List.of(usuario("a"), usuario("b"), usuario("c")));

        int enviadas = service.notificarSeguidores(actor, NotificacionTipo.SEGUIDO_LOGRO,
                "t", "m", "{}");

        assertThat(enviadas).isEqualTo(3);
        verify(notificacionService, times(3)).crear(
                any(Usuario.class), eq(NotificacionTipo.SEGUIDO_LOGRO), anyString(), anyString(), anyString());
    }

    @Test
    void sinSeguidoresNoNotifica() {
        Usuario actor = usuario("actor");
        when(seguidorRepository.seguidoresDe(actor)).thenReturn(List.of());

        int enviadas = service.notificarSeguidores(actor, NotificacionTipo.SEGUIDO_TORNEO,
                "t", "m", "{}");

        assertThat(enviadas).isZero();
    }

    @Test
    void actorNullNoRompe() {
        assertThat(service.notificarSeguidores(null, NotificacionTipo.SEGUIDO_LOGRO, "t", "m", "{}"))
                .isZero();
    }

    @Test
    void unFalloIndividualNoAbortaElResto() {
        Usuario actor = usuario("actor");
        when(seguidorRepository.seguidoresDe(actor))
                .thenReturn(List.of(usuario("a"), usuario("b")));
        // El primer crear() lanza; el segundo debe ejecutarse igual.
        when(notificacionService.crear(any(), any(), anyString(), anyString(), anyString()))
                .thenThrow(new RuntimeException("boom"))
                .thenReturn(null);

        int enviadas = service.notificarSeguidores(actor, NotificacionTipo.SEGUIDO_LOGRO,
                "t", "m", "{}");

        assertThat(enviadas).isEqualTo(1);
        verify(notificacionService, times(2)).crear(any(), any(), anyString(), anyString(), anyString());
    }

    @Test
    void respetaElTopeDeFanOut() {
        Usuario actor = usuario("actor");
        List<Usuario> muchos = new ArrayList<>();
        for (int i = 0; i < SeguidorFanOutService.MAX_FANOUT + 50; i++) {
            muchos.add(usuario("seg" + i));
        }
        when(seguidorRepository.seguidoresDe(actor)).thenReturn(muchos);

        int enviadas = service.notificarSeguidores(actor, NotificacionTipo.SEGUIDO_LOGRO,
                "t", "m", "{}");

        assertThat(enviadas).isEqualTo(SeguidorFanOutService.MAX_FANOUT);
        verify(notificacionService, times(SeguidorFanOutService.MAX_FANOUT))
                .crear(any(), any(), anyString(), anyString(), anyString());
    }
}
