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

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.diegoalegil.animeshowdown.model.AuditEvento;
import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

/**
 * Tests unitarios de la lógica de decisión del dropper (cap diario, motivos,
 * idempotencia) con dependencias mockeadas. La persistencia real se cubre en el
 * test de integración.
 */
class DropServiceTest {

    private final Usuario usuario = new Usuario("dropper", "{noop}secreta123", "dropper@example.com");

    private static final Clock UTC_CLOCK = Clock.fixed(Instant.parse("2026-06-02T12:00:00Z"), ZoneOffset.UTC);

    private DropService dropService(MonederoService monederoService,
            AuditLogService auditLogService, int topeDiario) {
        return dropService(monederoService, auditLogService, mock(VotoRepository.class), topeDiario, UTC_CLOCK);
    }

    private DropService dropService(MonederoService monederoService,
            AuditLogService auditLogService, int topeDiario, Clock clock) {
        return dropService(monederoService, auditLogService, mock(VotoRepository.class), topeDiario, clock);
    }

    private DropService dropService(MonederoService monederoService,
            AuditLogService auditLogService, VotoRepository votoRepository, int topeDiario, Clock clock) {
        return new DropService(monederoService, auditLogService, votoRepository, clock,
                8, 23, 38, 30, 3, topeDiario, 10);
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
                eq(usuario), eq(MotivoMovimiento.DROP_VOTO), eq("voto:10"), eq(8L),
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
                eq(usuario), eq(MotivoMovimiento.DROP_TORNEO), eq("prediccion:3"), eq(38L),
                eq(50), any(LocalDateTime.class)))
                .thenReturn(new MonederoService.ResultadoDrop(
                        MonederoService.ResultadoDrop.Estado.APLICADO, 38L));
        DropService service = dropService(monederoService, auditLogService, 50);

        assertThat(service.otorgar(usuario, MotivoMovimiento.DROP_TORNEO, "prediccion:3"))
                .isEqualTo(DropService.DropResultado.APLICADO);
        verify(monederoService).acreditarDropConTopeDiario(
                eq(usuario), eq(MotivoMovimiento.DROP_TORNEO), eq("prediccion:3"), eq(38L),
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

    @Test
    void candidatosVotoIncluyeMisionSiempreYHitoSoloEnMultiplos() {
        // 5 votos: solo misión diaria. 10 votos: misión + hito "voto:10".
        assertThat(DropService.candidatosVoto(5, 10, java.time.LocalDate.of(2026, 6, 5)))
                .extracting(DropService.DropCandidato::motivo)
                .containsExactly(MotivoMovimiento.DROP_MISION_DIARIA);
        assertThat(DropService.candidatosVoto(10, 10, java.time.LocalDate.of(2026, 6, 5)))
                .extracting(DropService.DropCandidato::referencia)
                .containsExactly("dia:2026-06-05", "voto:10");
    }

    @Test
    void previsualizarSumaMisionMasHitoCuandoNingunoSeAcreditoAun() {
        MonederoService monederoService = mock(MonederoService.class);
        VotoRepository votoRepo = mock(VotoRepository.class);
        // 9 votos confirmados + el que se está emitiendo = 10 → misión + hito.
        when(votoRepo.countByUsuario(usuario)).thenReturn(9L);
        when(monederoService.contarDropsHoy(eq(usuario), any(LocalDateTime.class))).thenReturn(0L);
        when(monederoService.yaAcreditado(any(), any(), any())).thenReturn(false);
        DropService service = dropService(monederoService, mock(AuditLogService.class), votoRepo, 100, UTC_CLOCK);

        // Voto nº 10 → misión (23) + hito (8) = 31.
        assertThat(service.previsualizarMonedasVoto(usuario)).isEqualTo(31L);
    }

    @Test
    void previsualizarNoCuentaLoYaAcreditado() {
        MonederoService monederoService = mock(MonederoService.class);
        VotoRepository votoRepo = mock(VotoRepository.class);
        when(votoRepo.countByUsuario(usuario)).thenReturn(9L);
        when(monederoService.contarDropsHoy(eq(usuario), any(LocalDateTime.class))).thenReturn(0L);
        // La misión del día ya se acreditó; el hito no.
        when(monederoService.yaAcreditado(usuario, MotivoMovimiento.DROP_MISION_DIARIA, "dia:2026-06-02"))
                .thenReturn(true);
        when(monederoService.yaAcreditado(usuario, MotivoMovimiento.DROP_VOTO, "voto:10"))
                .thenReturn(false);
        DropService service = dropService(monederoService, mock(AuditLogService.class), votoRepo, 100, UTC_CLOCK);

        assertThat(service.previsualizarMonedasVoto(usuario)).isEqualTo(8L);
    }

    @Test
    void previsualizarRespetaElTopeDiario() {
        MonederoService monederoService = mock(MonederoService.class);
        VotoRepository votoRepo = mock(VotoRepository.class);
        when(votoRepo.countByUsuario(usuario)).thenReturn(9L);
        // Ya alcanzó el tope: ningún candidato suma aunque no esté acreditado.
        when(monederoService.contarDropsHoy(eq(usuario), any(LocalDateTime.class))).thenReturn(100L);
        DropService service = dropService(monederoService, mock(AuditLogService.class), votoRepo, 100, UTC_CLOCK);

        assertThat(service.previsualizarMonedasVoto(usuario)).isEqualTo(0L);
    }

    @Test
    void previsualizarParaUsuarioNuloEsCero() {
        DropService service = dropService(mock(MonederoService.class), mock(AuditLogService.class), 100);
        assertThat(service.previsualizarMonedasVoto(null)).isEqualTo(0L);
    }

    @Test
    void inicioDelDiaSeCalculaEnLaZonaDeProducto() {
        // 03:30 UTC todavía es el día anterior en una zona UTC-6: el inicio del
        // día de producto debe ser la medianoche local convertida a UTC, no la
        // medianoche UTC. Garantiza que el tope diario respeta la zona del producto.
        MonederoService monederoService = mock(MonederoService.class);
        when(monederoService.acreditarDropConTopeDiario(
                any(), any(), any(), anyLong(), anyInt(), any(LocalDateTime.class)))
                .thenReturn(new MonederoService.ResultadoDrop(
                        MonederoService.ResultadoDrop.Estado.APLICADO, 5L));
        Clock clock = Clock.fixed(Instant.parse("2026-06-02T03:30:00Z"), ZoneId.of("America/Mexico_City"));
        DropService service = dropService(monederoService, mock(AuditLogService.class), 50, clock);

        service.otorgar(usuario, MotivoMovimiento.DROP_VOTO, "voto:10");

        ArgumentCaptor<LocalDateTime> desde = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(monederoService).acreditarDropConTopeDiario(
                eq(usuario), eq(MotivoMovimiento.DROP_VOTO), eq("voto:10"), eq(8L),
                eq(50), desde.capture());
        assertThat(desde.getValue()).isEqualTo(LocalDateTime.of(2026, 6, 1, 6, 0));
    }
}
