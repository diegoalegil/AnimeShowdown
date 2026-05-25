package com.diegoalegil.animeshowdown.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.Collection;

import org.junit.jupiter.api.Test;

import com.diegoalegil.animeshowdown.model.AuditEvento;
import com.diegoalegil.animeshowdown.repository.AuditLogRepository;
import com.diegoalegil.animeshowdown.security.ClientIpExtractor;
import com.fasterxml.jackson.databind.ObjectMapper;

class AuditLogServiceTest {

    @Test
    void purgarRetencionBorraSensiblesATreintaDiasYGeneralANoventa() {
        AuditLogRepository repository = mock(AuditLogRepository.class);
        AuditLogService service = new AuditLogService(
                repository,
                new ObjectMapper(),
                mock(ClientIpExtractor.class),
                90,
                30);
        LocalDateTime referencia = LocalDateTime.of(2026, 5, 25, 3, 0);
        when(repository.deleteByEventoInAndTsBefore(any(Collection.class), eq(referencia.minusDays(30))))
                .thenReturn(4L);
        when(repository.deleteByTsBefore(referencia.minusDays(90))).thenReturn(7L);

        AuditLogService.PurgeResult result = service.purgarRetencion(referencia);

        assertEquals(7L, result.generalDeleted());
        assertEquals(4L, result.sensitiveDeleted());
        assertEquals(11L, result.totalDeleted());
        verify(repository).deleteByEventoInAndTsBefore(any(Collection.class), eq(referencia.minusDays(30)));
        verify(repository).deleteByTsBefore(referencia.minusDays(90));
    }

    @Test
    void purgarRetencionIncluyeEventosDeCredencialesComoSensibles() {
        AuditLogRepository repository = mock(AuditLogRepository.class);
        AuditLogService service = new AuditLogService(
                repository,
                new ObjectMapper(),
                mock(ClientIpExtractor.class),
                90,
                30);

        service.purgarRetencion(LocalDateTime.of(2026, 5, 25, 3, 0));

        verify(repository).deleteByEventoInAndTsBefore(
                org.mockito.ArgumentMatchers.argThat(eventos ->
                        eventos.contains(AuditEvento.LOGIN_FAIL)
                                && eventos.contains(AuditEvento.PASSWORD_RESET_SOLICITADO)
                                && eventos.contains(AuditEvento.REFRESH_TOKEN_REUSE_DETECTADO)
                                && eventos.contains(AuditEvento.TOTP_LOGIN_FAIL)),
                any(LocalDateTime.class));
    }
}
