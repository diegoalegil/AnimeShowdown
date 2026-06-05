package com.diegoalegil.animeshowdown.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.diegoalegil.animeshowdown.event.PrediccionResueltaEvent;
import com.diegoalegil.animeshowdown.event.VotoRegistradoEvent;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

@ExtendWith(MockitoExtension.class)
class BadgeEventListenerTest {

    @Mock private BadgeService badgeService;
    @Mock private MadrugadorService madrugadorService;
    @Mock private VotoRepository votoRepository;
    @Mock private UsuarioRepository usuarioRepository;

    private BadgeEventListener listener() {
        return new BadgeEventListener(badgeService, madrugadorService, votoRepository, usuarioRepository);
    }

    @Test
    void primerVotoDesbloqueaSoloPrimerVotoYRegistraMadrugador() {
        Usuario u = mock(Usuario.class);
        when(votoRepository.countByUsuario(u)).thenReturn(1L);

        listener().onVoto(new VotoRegistradoEvent(u, null));

        verify(badgeService).desbloquear(u, "primer_voto");
        verify(badgeService, never()).desbloquear(u, "cien_votos");
        verify(badgeService, never()).desbloquear(u, "mil_votos");
        verify(madrugadorService).registrarPrimerVotoDelDia(u, null);
    }

    @Test
    void milVotosDesbloqueaLosTresUmbrales() {
        Usuario u = mock(Usuario.class);
        when(votoRepository.countByUsuario(u)).thenReturn(1000L);

        listener().onVoto(new VotoRegistradoEvent(u, null));

        verify(badgeService).desbloquear(u, "primer_voto");
        verify(badgeService).desbloquear(u, "cien_votos");
        verify(badgeService).desbloquear(u, "mil_votos");
    }

    @Test
    void prediccionConUsuarioInexistenteNoDesbloquea() {
        when(usuarioRepository.findById(7L)).thenReturn(Optional.empty());

        listener().onPrediccionResuelta(new PrediccionResueltaEvent(7L, "x", 5L, 3));

        verify(badgeService, never()).desbloquear(any(), any());
    }

    @Test
    void prediccionConRachaDeTresDesbloqueaSoloEseBadge() {
        Usuario u = mock(Usuario.class);
        when(usuarioRepository.findById(7L)).thenReturn(Optional.of(u));

        listener().onPrediccionResuelta(new PrediccionResueltaEvent(7L, "x", 5L, 3));

        verify(badgeService).desbloquear(u, "predicciones_3_seguidas");
        verify(badgeService, never()).desbloquear(u, "predicciones_10_seguidas");
        verify(badgeService, never()).desbloquear(u, "profeta");
    }
}
