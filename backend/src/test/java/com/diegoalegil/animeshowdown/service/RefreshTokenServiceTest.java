package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.diegoalegil.animeshowdown.model.RefreshToken;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.RefreshTokenRepository;

/**
 * Tests unitarios de {@link RefreshTokenService} — fija la rotación y la
 * detección de reuse (Auth0-style), que son seguridad crítica y antes solo se
 * cubrían de forma indirecta. Mockea el repositorio.
 */
@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

    @Mock
    private RefreshTokenRepository repository;

    private RefreshTokenService service;
    private final Usuario usuario = usuario();

    @BeforeEach
    void setUp() {
        service = new RefreshTokenService(repository, 30);
    }

    @Test
    void rotarConTokenNuloOVacioEsInvalido() {
        assertThat(service.rotar(null, "ua", "ip"))
                .isInstanceOf(RefreshTokenService.ResultadoRotacion.Invalido.class);
        assertThat(service.rotar("   ", "ua", "ip"))
                .isInstanceOf(RefreshTokenService.ResultadoRotacion.Invalido.class);
    }

    @Test
    void rotarConHashInexistenteEsInvalido() {
        when(repository.findByTokenHashForRotation(anyString())).thenReturn(Optional.empty());

        assertThat(service.rotar("token-plano", "ua", "ip"))
                .isInstanceOf(RefreshTokenService.ResultadoRotacion.Invalido.class);
    }

    @Test
    void rotarTokenActivoDevuelveOkYRevocaElViejo() {
        RefreshToken activo = new RefreshToken(usuario, "hash", LocalDateTime.now().plusDays(10), "ua", "ip");
        when(repository.findByTokenHashForRotation(anyString())).thenReturn(Optional.of(activo));

        RefreshTokenService.ResultadoRotacion r = service.rotar("token-plano", "ua", "ip");

        assertThat(r).isInstanceOf(RefreshTokenService.ResultadoRotacion.Ok.class);
        assertThat(activo.getRevocadoEn()).isNotNull(); // el viejo quedó revocado
        verify(repository, times(2)).save(any(RefreshToken.class)); // save(viejo) + save(nuevo de emitir)
    }

    @Test
    void rotarTokenRevocadoDentroDeGraceEsCrossTabSinEscalada() {
        RefreshToken viejo = new RefreshToken(usuario, "hash", LocalDateTime.now().plusDays(10), "ua", "ip");
        viejo.setRevocadoEn(LocalDateTime.now().minusSeconds(3)); // dentro del grace (10s)
        when(repository.findByTokenHashForRotation(anyString())).thenReturn(Optional.of(viejo));

        RefreshTokenService.ResultadoRotacion r = service.rotar("token-plano", "ua", "ip");

        assertThat(r).isInstanceOf(RefreshTokenService.ResultadoRotacion.GraceCrossTab.class);
        verify(repository, never()).revocarTodosDelUsuario(any(), any());
    }

    @Test
    void rotarTokenRevocadoFueraDeGraceDisparaReuseDetection() {
        RefreshToken viejo = new RefreshToken(usuario, "hash", LocalDateTime.now().plusDays(10), "ua", "ip");
        viejo.setRevocadoEn(LocalDateTime.now().minusSeconds(30)); // más allá del grace
        when(repository.findByTokenHashForRotation(anyString())).thenReturn(Optional.of(viejo));

        RefreshTokenService.ResultadoRotacion r = service.rotar("token-plano", "ua", "ip");

        assertThat(r).isInstanceOf(RefreshTokenService.ResultadoRotacion.Invalido.class);
        verify(repository).revocarTodosDelUsuario(eq(usuario), any(LocalDateTime.class)); // mata TODAS las sesiones
    }

    @Test
    void rotarTokenExpiradoEsInvalido() {
        RefreshToken expirado = new RefreshToken(usuario, "hash", LocalDateTime.now().minusMinutes(1), "ua", "ip");
        when(repository.findByTokenHashForRotation(anyString())).thenReturn(Optional.of(expirado));

        RefreshTokenService.ResultadoRotacion r = service.rotar("token-plano", "ua", "ip");

        assertThat(r).isInstanceOf(RefreshTokenService.ResultadoRotacion.Invalido.class);
    }

    private static Usuario usuario() {
        Usuario u = new Usuario("bob", "{noop}x", "bob@test.com");
        u.setId(7L);
        return u;
    }
}
