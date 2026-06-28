package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import com.diegoalegil.animeshowdown.model.NotificacionTipo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.SeguidorRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

/**
 * Tests de {@link SeguidorService}: aislamiento de la notificación de follow
 * (clase aborted-tx) y tope de las listas públicas.
 */
class SeguidorServiceTest {

    private SeguidorRepository repo;
    private UsuarioRepository usuarioRepository;
    private NotificacionService notificacionService;
    private SeguidorService service;

    @BeforeEach
    void setUp() {
        repo = mock(SeguidorRepository.class);
        usuarioRepository = mock(UsuarioRepository.class);
        notificacionService = mock(NotificacionService.class);
        service = new SeguidorService(repo, usuarioRepository, notificacionService);
    }

    private static Usuario usuario(long id, String username) {
        Usuario u = new Usuario(username, "x", username + "@example.com");
        ReflectionTestUtils.setField(u, "id", id);
        return u;
    }

    @Test
    void seguirPersisteYNotificaEnTxAislada() {
        Usuario seguidor = usuario(1L, "seguidor");
        Usuario seguido = usuario(2L, "seguido");
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(seguido));
        when(repo.insertarSiFalta(1L, 2L)).thenReturn(1);

        assertThat(service.seguir(seguidor, 2L)).isTrue();
        verify(notificacionService).crearAislada(
                eq(seguido), eq(NotificacionTipo.SEGUIDOR_NUEVO), anyString(), anyString(), anyString());
    }

    @Test
    void seguirSeConfirmaAunqueLaNotificacionFalle() {
        // Garantía de la clase aborted-tx: una notificación rota NO debe tumbar el
        // follow. Va en su propia tx (REQUIRES_NEW) y aquí el fallo se captura;
        // el follow se confirma igual.
        Usuario seguidor = usuario(1L, "seguidor");
        Usuario seguido = usuario(2L, "seguido");
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(seguido));
        when(repo.insertarSiFalta(1L, 2L)).thenReturn(1);
        doThrow(new RuntimeException("notif down")).when(notificacionService).crearAislada(
                any(Usuario.class), any(NotificacionTipo.class), anyString(), anyString(), anyString());

        assertThat(service.seguir(seguidor, 2L)).isTrue();
    }

    @Test
    void seguirIdempotenteNoReNotifica() {
        Usuario seguidor = usuario(1L, "seguidor");
        Usuario seguido = usuario(2L, "seguido");
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(seguido));
        when(repo.insertarSiFalta(1L, 2L)).thenReturn(0); // ya lo sigue

        assertThat(service.seguir(seguidor, 2L)).isFalse();
        verify(notificacionService, never()).crearAislada(any(), any(), anyString(), anyString(), anyString());
    }

    @Test
    void listasPublicasSeTopanA200() {
        Usuario u = usuario(1L, "popular");
        List<Usuario> muchos = IntStream.range(0, 250)
                .mapToObj(i -> usuario(100L + i, "f" + i))
                .toList();
        when(repo.seguidosDe(u)).thenReturn(muchos);
        when(repo.seguidoresDe(u)).thenReturn(muchos);

        assertThat(service.listarSeguidos(u)).hasSize(200);
        assertThat(service.listarSeguidores(u)).hasSize(200);
    }
}
