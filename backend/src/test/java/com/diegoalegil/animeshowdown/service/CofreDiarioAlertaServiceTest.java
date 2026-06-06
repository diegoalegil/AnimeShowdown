package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.NotificacionTipo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

import org.springframework.data.domain.Pageable;

class CofreDiarioAlertaServiceTest {

    private static final Clock FIXED = Clock.fixed(Instant.parse("2026-06-06T18:00:00Z"), ZoneOffset.UTC);

    private final UsuarioRepository usuarioRepository = mock(UsuarioRepository.class);
    private final NotificacionService notificacionService = mock(NotificacionService.class);
    private final CofreDiarioAlertaService service =
            new CofreDiarioAlertaService(usuarioRepository, notificacionService, FIXED, 5000);

    private static Usuario usuario(String username) {
        return new Usuario(username, "{noop}secreta123", username + "@example.com");
    }

    @Test
    void notificaaLosNoReclamantesConReferenciaYEventoKeyDelDia() {
        when(usuarioRepository.findSinMovimiento(
                eq(MotivoMovimiento.COFRE_DIARIO), eq("cofre:2026-06-06"), any(Pageable.class)))
                .thenReturn(List.of(usuario("a"), usuario("b")));
        when(notificacionService.crearSiNoExiste(any(), eq(NotificacionTipo.COFRE_DISPONIBLE),
                any(), any(), any(), eq("cofre-disp:2026-06-06")))
                .thenReturn(true);

        assertThat(service.notificarCofreDisponible()).isEqualTo(2);
        verify(usuarioRepository).findSinMovimiento(
                eq(MotivoMovimiento.COFRE_DIARIO), eq("cofre:2026-06-06"), any(Pageable.class));
    }

    @Test
    void noCuentaLosYaNotificados() {
        when(usuarioRepository.findSinMovimiento(any(), any(), any(Pageable.class)))
                .thenReturn(List.of(usuario("a"), usuario("b")));
        // crearSiNoExiste devuelve false (ya existía hoy) → idempotente, no suma
        when(notificacionService.crearSiNoExiste(any(), any(), any(), any(), any(), any()))
                .thenReturn(false);

        assertThat(service.notificarCofreDisponible()).isZero();
    }

    @Test
    void sinNoReclamantesNoHaceNada() {
        when(usuarioRepository.findSinMovimiento(any(), any(), any(Pageable.class)))
                .thenReturn(List.of());

        assertThat(service.notificarCofreDisponible()).isZero();
        verify(notificacionService, org.mockito.Mockito.never())
                .crearSiNoExiste(any(), any(), any(), any(), any(), any());
    }
}
