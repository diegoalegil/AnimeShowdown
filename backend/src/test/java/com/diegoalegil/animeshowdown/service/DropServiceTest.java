package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;

import com.diegoalegil.animeshowdown.model.AuditEvento;
import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.MonederoMovimientoRepository;

/**
 * Tests unitarios de la lógica de decisión del dropper (cap diario, motivos,
 * idempotencia) con dependencias mockeadas. La persistencia real se cubre en el
 * test de integración.
 */
class DropServiceTest {

    private final Usuario usuario = new Usuario("dropper", "{noop}secreta123", "dropper@example.com");

    private DropService dropService(MonederoService monederoService,
            MonederoMovimientoRepository movimientoRepo, AuditLogService auditLogService, int topeDiario) {
        return new DropService(monederoService, movimientoRepo, auditLogService,
                5, 15, 25, 20, topeDiario);
    }

    @Test
    void usuarioNuloSeOmite() {
        DropService service = dropService(mock(MonederoService.class),
                mock(MonederoMovimientoRepository.class), mock(AuditLogService.class), 50);

        assertThat(service.otorgar(null, MotivoMovimiento.DROP_VOTO, "voto:10"))
                .isEqualTo(DropService.DropResultado.OMITIDO);
    }

    @Test
    void motivoSinRecompensaSeOmite() {
        DropService service = dropService(mock(MonederoService.class),
                mock(MonederoMovimientoRepository.class), mock(AuditLogService.class), 50);

        // COMPRA_SOBRE es un gasto, no un drop: no tiene recompensa configurada.
        assertThat(service.otorgar(usuario, MotivoMovimiento.COMPRA_SOBRE, "x"))
                .isEqualTo(DropService.DropResultado.OMITIDO);
    }

    @Test
    void superarTopeDiarioNoAcredita() {
        MonederoService monederoService = mock(MonederoService.class);
        MonederoMovimientoRepository movimientoRepo = mock(MonederoMovimientoRepository.class);
        when(movimientoRepo.countByUsuarioAndDeltaGreaterThanAndCreadoEnAfter(
                any(Usuario.class), eq(0L), any(LocalDateTime.class))).thenReturn(2L);
        DropService service = dropService(monederoService, movimientoRepo, mock(AuditLogService.class), 2);

        assertThat(service.otorgar(usuario, MotivoMovimiento.DROP_VOTO, "voto:10"))
                .isEqualTo(DropService.DropResultado.TOPE_DIARIO);
        verify(monederoService, never()).acreditar(any(), any(), any(), anyLong());
    }

    @Test
    void dropAplicadoAcreditaYAudita() {
        MonederoService monederoService = mock(MonederoService.class);
        MonederoMovimientoRepository movimientoRepo = mock(MonederoMovimientoRepository.class);
        AuditLogService auditLogService = mock(AuditLogService.class);
        when(movimientoRepo.countByUsuarioAndDeltaGreaterThanAndCreadoEnAfter(
                any(Usuario.class), eq(0L), any(LocalDateTime.class))).thenReturn(0L);
        when(monederoService.acreditar(eq(usuario), eq(MotivoMovimiento.DROP_TORNEO), eq("prediccion:3"), eq(25L)))
                .thenReturn(new MonederoService.ResultadoCredito(true, 25L));
        DropService service = dropService(monederoService, movimientoRepo, auditLogService, 50);

        assertThat(service.otorgar(usuario, MotivoMovimiento.DROP_TORNEO, "prediccion:3"))
                .isEqualTo(DropService.DropResultado.APLICADO);
        verify(monederoService).acreditar(usuario, MotivoMovimiento.DROP_TORNEO, "prediccion:3", 25L);
        verify(auditLogService).registrar(eq(AuditEvento.MONEDA_GANADA), eq(usuario), any(), eq(null));
    }

    @Test
    void dropYaAplicadoEsIdempotenteYNoAudita() {
        MonederoService monederoService = mock(MonederoService.class);
        MonederoMovimientoRepository movimientoRepo = mock(MonederoMovimientoRepository.class);
        AuditLogService auditLogService = mock(AuditLogService.class);
        when(movimientoRepo.countByUsuarioAndDeltaGreaterThanAndCreadoEnAfter(
                any(Usuario.class), eq(0L), any(LocalDateTime.class))).thenReturn(0L);
        when(monederoService.acreditar(any(), any(), any(), anyLong()))
                .thenReturn(new MonederoService.ResultadoCredito(false, 40L));
        DropService service = dropService(monederoService, movimientoRepo, auditLogService, 50);

        assertThat(service.otorgar(usuario, MotivoMovimiento.DROP_DUELO, "duelo:7"))
                .isEqualTo(DropService.DropResultado.IDEMPOTENTE);
        verify(auditLogService, never()).registrar(any(), any(), any(), any());
    }
}
