package com.diegoalegil.animeshowdown.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.diegoalegil.animeshowdown.model.EmailFailure;
import com.diegoalegil.animeshowdown.model.EmailTipo;
import com.diegoalegil.animeshowdown.repository.EmailFailureRepository;

/**
 * Cubre el {@code @Recover}: cuando un envío agota sus reintentos debe (a)
 * incrementar la métrica de fallo del embudo — la señal de alerta del roadmap —
 * y (b) persistir el contenido en email_failed_queue para reintento manual.
 */
@ExtendWith(MockitoExtension.class)
class EmailServiceTest {

    @Mock private EmailFailureRepository emailFailureRepository;
    @Mock private AnimeShowdownMetrics metrics;

    private EmailService nuevoServicio() {
        // apiKey/from vacíos: onEnvioFallido no usa el RestClient ni la
        // self-injection, así que un servicio "offline" basta para el @Recover.
        return new EmailService(emailFailureRepository, metrics, "", "onboarding@resend.dev");
    }

    @Test
    void elRecoverIncrementaLaMetricaYPersistaElFallo() {
        EmailService service = nuevoServicio();

        service.onEnvioFallido(new RuntimeException("resend 503"),
                EmailTipo.VERIFICACION, "ana@example.com", "Verifica tu email", "cuerpo");

        verify(metrics).emailFallo(EmailTipo.VERIFICACION);
        verify(emailFailureRepository).save(any(EmailFailure.class));
    }

    @Test
    void siLaPersistenciaFallaElRecoverNoPropaga() {
        org.mockito.Mockito.when(emailFailureRepository.save(any(EmailFailure.class)))
                .thenThrow(new RuntimeException("db down"));
        EmailService service = nuevoServicio();

        // No debe lanzar: perder el email es malo, romper el hilo del executor peor.
        service.onEnvioFallido(new RuntimeException("resend 503"),
                EmailTipo.RESET_PASSWORD, "ana@example.com", "Reset", "cuerpo");

        verify(metrics).emailFallo(EmailTipo.RESET_PASSWORD);
    }
}
