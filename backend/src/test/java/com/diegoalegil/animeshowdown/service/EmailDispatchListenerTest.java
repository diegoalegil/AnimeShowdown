package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.diegoalegil.animeshowdown.event.EmailVerificacionEmitidaEvent;
import com.diegoalegil.animeshowdown.event.PasswordResetSolicitadoEvent;

@ExtendWith(MockitoExtension.class)
class EmailDispatchListenerTest {

    @Mock private EmailService emailService;

    @Test
    void despachaElCodigoDeResetConLosDatosDelEvento() {
        EmailDispatchListener listener = new EmailDispatchListener(emailService);

        listener.onPasswordResetSolicitado(
                new PasswordResetSolicitadoEvent("ana@example.com", "ana", "123456"));

        verify(emailService).enviarCodigoReset("ana@example.com", "ana", "123456");
    }

    @Test
    void despachaLaVerificacionConLosDatosDelEvento() {
        EmailDispatchListener listener = new EmailDispatchListener(emailService);

        listener.onEmailVerificacionEmitida(new EmailVerificacionEmitidaEvent(
                "ana@example.com", "ana", "https://animeshowdown.dev/verify?token=abc"));

        verify(emailService).enviarVerificacion(
                "ana@example.com", "ana", "https://animeshowdown.dev/verify?token=abc");
    }

    @Test
    void unFalloEnElEnvioNoPropaga() {
        doThrow(new RuntimeException("resend caido"))
                .when(emailService).enviarCodigoReset(any(), any(), any());
        doThrow(new RuntimeException("resend caido"))
                .when(emailService).enviarVerificacion(any(), any(), any());
        EmailDispatchListener listener = new EmailDispatchListener(emailService);

        assertThatNoException().isThrownBy(() -> listener.onPasswordResetSolicitado(
                new PasswordResetSolicitadoEvent("ana@example.com", "ana", "123456")));
        assertThatNoException().isThrownBy(() -> listener.onEmailVerificacionEmitida(
                new EmailVerificacionEmitidaEvent("ana@example.com", "ana", "link")));
    }
}
