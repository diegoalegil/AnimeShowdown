package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;

import com.diegoalegil.animeshowdown.model.Logro;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.LogroRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

@ExtendWith(MockitoExtension.class)
class FundadorBadgeServiceTest {

    @Mock private LogroRepository logroRepository;
    @Mock private UsuarioRepository usuarioRepository;
    @Mock private BadgeService badgeService;

    private FundadorBadgeService service;

    @BeforeEach
    void setUp() {
        service = new FundadorBadgeService(
                logroRepository,
                usuarioRepository,
                badgeService,
                2);
    }

    @Test
    void siElLogroNoExisteLoSiembra() {
        when(logroRepository.findByCodigo(FundadorBadgeService.CODIGO_FUNDADOR))
                .thenReturn(Optional.empty());
        when(logroRepository.saveAndFlush(any(Logro.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.sembrarLogroSiFalta();

        verify(logroRepository).saveAndFlush(any(Logro.class));
        verify(logroRepository).saveAndFlush(org.mockito.ArgumentMatchers.argThat(logro ->
                FundadorBadgeService.CODIGO_FUNDADOR.equals(logro.getCodigo())
                        && "Fundador".equals(logro.getNombre())
                        && Short.valueOf((short) 5).equals(logro.getRareza())));
    }

    @Test
    void backfillDesbloqueaSoloLosPrimerosDelCutoff() {
        Usuario primero = usuario(1L, "primero", LocalDateTime.parse("2026-01-01T00:00:00"));
        Usuario segundo = usuario(2L, "segundo", LocalDateTime.parse("2026-01-02T00:00:00"));
        when(usuarioRepository.findPrimerosPorFechaRegistro(PageRequest.of(0, 2)))
                .thenReturn(List.of(primero, segundo));

        service.backfillElegibles();

        verify(badgeService).desbloquear(primero, FundadorBadgeService.CODIGO_FUNDADOR);
        verify(badgeService).desbloquear(segundo, FundadorBadgeService.CODIGO_FUNDADOR);
    }

    @Test
    void registroDentroDelCutoffRecibeFundador() {
        Usuario usuario = usuario(9L, "nuevo", LocalDateTime.parse("2026-01-03T00:00:00"));
        Logro fundador = new Logro(FundadorBadgeService.CODIGO_FUNDADOR, "Fundador", "x", "Crown", (short) 5);
        when(logroRepository.findByCodigo(FundadorBadgeService.CODIGO_FUNDADOR))
                .thenReturn(Optional.of(fundador));
        when(usuarioRepository.posicionPorFechaRegistro(usuario.getFechaRegistro(), usuario.getId()))
                .thenReturn(2L);

        service.otorgarSiElegible(usuario);

        verify(badgeService).desbloquear(usuario, FundadorBadgeService.CODIGO_FUNDADOR);
    }

    @Test
    void registroFueraDelCutoffNoRecibeFundador() {
        Usuario usuario = usuario(10L, "tarde", LocalDateTime.parse("2026-01-04T00:00:00"));
        Logro fundador = new Logro(FundadorBadgeService.CODIGO_FUNDADOR, "Fundador", "x", "Crown", (short) 5);
        when(logroRepository.findByCodigo(FundadorBadgeService.CODIGO_FUNDADOR))
                .thenReturn(Optional.of(fundador));
        when(usuarioRepository.posicionPorFechaRegistro(usuario.getFechaRegistro(), usuario.getId()))
                .thenReturn(3L);

        service.otorgarSiElegible(usuario);

        verify(badgeService, never()).desbloquear(eq(usuario), eq(FundadorBadgeService.CODIGO_FUNDADOR));
    }

    @Test
    void cutoffCeroDesactivaBackfillYOtorgado() {
        FundadorBadgeService desactivado = new FundadorBadgeService(
                logroRepository,
                usuarioRepository,
                badgeService,
                0);

        desactivado.backfillElegibles();
        desactivado.otorgarSiElegible(usuario(1L, "nadie", LocalDateTime.now()));

        verify(usuarioRepository, never()).findPrimerosPorFechaRegistro(any());
        verify(badgeService, never()).desbloquear(any(), eq(FundadorBadgeService.CODIGO_FUNDADOR));
    }

    private static Usuario usuario(Long id, String username, LocalDateTime fechaRegistro) {
        Usuario usuario = new Usuario(username, "{noop}secreta123", username + "@example.com");
        usuario.setId(id);
        usuario.setFechaRegistro(fechaRegistro);
        assertThat(usuario.getId()).isEqualTo(id);
        return usuario;
    }
}
