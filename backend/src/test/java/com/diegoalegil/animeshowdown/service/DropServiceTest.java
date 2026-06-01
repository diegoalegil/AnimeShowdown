package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
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

/**
 * Tests unitarios de la lógica de decisión del dropper (cap diario, motivos,
 * idempotencia) con dependencias mockeadas. La persistencia real se cubre en el
 * test de integración.
 */
class DropServiceTest {

    private final Usuario usuario = new Usuario("dropper", "{noop}secreta123", "dropper@example.com");

    private DropService dropService(MonederoService monederoService,
            AuditLogService auditLogService, int topeDiario) {
        return new DropService(monederoService, auditLogService,
                5, 15, 25, 20, topeDiario);
    }

    @Test
    void usuarioNuloSeOmite() {
        DropService service = dropService(mock(MonederoService.class),
                mock(AuditLogService.class), 50);

        assertThat(service.otorgar(null, MotivoMovimiento.DROP_VOTO, "voto:10"))
                .isEqualTo(DropService.DropResultado.OMITIDO);
    }

    @Test
    void motivoSinRecompensaSeOmite() {
        DropService service = dropService(mock(MonederoService.class),
                mock(AuditLogService.class), 50);

        // COMPRA_SOBRE es un gasto, no un drop: no tiene recompensa configurada.
        assertThat(service.otorgar(usuario, MotivoMovimiento.COMPRA_SOBRE, "x"))
                .isEqualTo(DropService.DropResultado.OMITIDO);
    }

    @Test
    void superarTopeDiarioNoAcredita() {
        MonederoService monederoService = mock(MonederoService.class);
        when(monederoService.acreditarDropConTopeDiario(
                eq(usuario), eq(MotivoMovimiento.DROP_VOTO), eq("voto:10"), eq(5L),
                eq(2), any(LocalDateTime.class)))
                .thenReturn(new MonederoService.ResultadoDrop(
                        MonederoService.ResultadoDrop.Estado.TOPE_DIARIO, 0L));
        DropService service = dropService(monederoService, mock(AuditLogService.class), 2);

        assertThat(service.otorgar(usuario, MotivoMovimiento.DROP_VOTO, "voto:10"))
                .isEqualTo(DropService.DropResultado.TOPE_DIARIO);
        verify(monederoService, never()).acreditar(any(), any(), any(), anyLong());
    }

    @Test
    void dropAplicadoAcreditaYAudita() {
        MonederoService monederoService = mock(MonederoService.class);
        AuditLogService auditLogService = mock(AuditLogService.class);
        when(monederoService.acreditarDropConTopeDiario(
                eq(usuario), eq(MotivoMovimiento.DROP_TORNEO), eq("prediccion:3"), eq(25L),
                eq(50), any(LocalDateTime.class)))
                .thenReturn(new MonederoService.ResultadoDrop(
                        MonederoService.ResultadoDrop.Estado.APLICADO, 25L));
        DropService service = dropService(monederoService, auditLogService, 50);

        assertThat(service.otorgar(usuario, MotivoMovimiento.DROP_TORNEO, "prediccion:3"))
                .isEqualTo(DropService.DropResultado.APLICADO);
        verify(monederoService).acreditarDropConTopeDiario(
                eq(usuario), eq(MotivoMovimiento.DROP_TORNEO), eq("prediccion:3"), eq(25L),
                eq(50), any(LocalDateTime.class));
        verify(auditLogService).registrar(eq(AuditEvento.MONEDA_GANADA), eq(usuario), any(), eq(null));
    }

    @Test
    void dropYaAplicadoEsIdempotenteYNoAudita() {
        MonederoService monederoService = mock(MonederoService.class);
        AuditLogService auditLogService = mock(AuditLogService.class);
        when(monederoService.acreditarDropConTopeDiario(any(), any(), any(), anyLong(), anyInt(), any()))
                .thenReturn(new MonederoService.ResultadoDrop(
                        MonederoService.ResultadoDrop.Estado.IDEMPOTENTE, 40L));
        DropService service = dropService(monederoService, auditLogService, 50);

        assertThat(service.otorgar(usuario, MotivoMovimiento.DROP_DUELO, "duelo:7"))
                .isEqualTo(DropService.DropResultado.IDEMPOTENTE);
        verify(auditLogService, never()).registrar(any(), any(), any(), any());
    }
}
