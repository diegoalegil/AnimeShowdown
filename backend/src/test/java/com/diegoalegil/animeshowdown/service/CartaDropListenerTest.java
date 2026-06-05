package com.diegoalegil.animeshowdown.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.diegoalegil.animeshowdown.event.DueloLiveFinalizadoEvent;
import com.diegoalegil.animeshowdown.event.PrediccionResueltaEvent;
import com.diegoalegil.animeshowdown.event.VotoRegistradoEvent;
import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

@ExtendWith(MockitoExtension.class)
class CartaDropListenerTest {

    private static final Clock FIXED_CLOCK =
            Clock.fixed(Instant.parse("2026-06-05T12:00:00Z"), ZoneOffset.UTC);

    @Mock private DropService dropService;
    @Mock private VotoRepository votoRepository;
    @Mock private UsuarioRepository usuarioRepository;

    private CartaDropListener listener() {
        return new CartaDropListener(dropService, votoRepository, usuarioRepository, FIXED_CLOCK, 10);
    }

    @Test
    void votoConUsuarioNuloNoDropea() {
        listener().onVoto(new VotoRegistradoEvent(null, null));

        verify(dropService, never()).otorgar(any(), any(), any());
    }

    @Test
    void votoDropeaMisionDiariaYNoElHitoSiNoEsMultiploDeN() {
        Usuario u = mock(Usuario.class);
        when(votoRepository.countByUsuario(u)).thenReturn(5L);

        listener().onVoto(new VotoRegistradoEvent(u, null));

        verify(dropService).otorgar(u, MotivoMovimiento.DROP_MISION_DIARIA,
                "dia:" + LocalDate.now(FIXED_CLOCK));
        verify(dropService, never()).otorgar(eq(u), eq(MotivoMovimiento.DROP_VOTO), any());
    }

    @Test
    void votoMultiploDeNDropeaTambienElHito() {
        Usuario u = mock(Usuario.class);
        when(votoRepository.countByUsuario(u)).thenReturn(10L);

        listener().onVoto(new VotoRegistradoEvent(u, null));

        verify(dropService).otorgar(u, MotivoMovimiento.DROP_MISION_DIARIA,
                "dia:" + LocalDate.now(FIXED_CLOCK));
        verify(dropService).otorgar(u, MotivoMovimiento.DROP_VOTO, "voto:10");
    }

    @Test
    void dueloConGanadorDropeaDropDuelo() {
        Usuario u = mock(Usuario.class);
        when(usuarioRepository.findById(42L)).thenReturn(Optional.of(u));

        listener().onDueloFinalizado(new DueloLiveFinalizadoEvent(7L, 42L));

        verify(dropService).otorgar(u, MotivoMovimiento.DROP_DUELO, "duelo:7");
    }

    @Test
    void dueloSinGanadorNoDropea() {
        listener().onDueloFinalizado(new DueloLiveFinalizadoEvent(7L, null));

        verify(dropService, never()).otorgar(any(), any(), any());
    }

    @Test
    void prediccionResueltaDropeaDropTorneoConElTotalDeAciertos() {
        Usuario u = mock(Usuario.class);
        when(usuarioRepository.findById(3L)).thenReturn(Optional.of(u));

        listener().onPrediccionResuelta(new PrediccionResueltaEvent(3L, "x", 8L, 2));

        verify(dropService).otorgar(u, MotivoMovimiento.DROP_TORNEO, "prediccion:8");
    }
}
