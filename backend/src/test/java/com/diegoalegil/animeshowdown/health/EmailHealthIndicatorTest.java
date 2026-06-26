package com.diegoalegil.animeshowdown.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.Status;

import com.diegoalegil.animeshowdown.repository.EmailFailureRepository;

@ExtendWith(MockitoExtension.class)
class EmailHealthIndicatorTest {

    @Mock private EmailFailureRepository emailFailureRepository;

    private EmailHealthIndicator indicator(String apiKey, String from) {
        return new EmailHealthIndicator(emailFailureRepository, apiKey, from);
    }

    @Test
    void sinApiKeyDevuelveDegradedNuncaDown() {
        Health h = indicator("", "envios@animeshowdown.dev").health();
        // DEGRADED, no DOWN: un email mal configurado no debe 503 el healthcheck.
        assertThat(h.getStatus()).isEqualTo(new Status("DEGRADED"));
        assertThat(h.getStatus()).isNotEqualTo(Status.DOWN);
        assertThat(h.getDetails().get("razon").toString()).contains("RESEND_API_KEY");
    }

    @Test
    void conSenderDePruebaDevuelveDegraded() {
        Health h = indicator("re_live_key", "onboarding@resend.dev").health();
        assertThat(h.getStatus()).isEqualTo(new Status("DEGRADED"));
        assertThat(h.getDetails().get("razon").toString()).contains("sender de prueba");
    }

    @Test
    void conSenderVacioDevuelveDegraded() {
        Health h = indicator("re_live_key", "   ").health();
        assertThat(h.getStatus()).isEqualTo(new Status("DEGRADED"));
    }

    @Test
    void bienConfiguradoYColaSanaDevuelveUp() {
        // Por debajo del umbral el conteo acotado es exacto.
        when(emailFailureRepository.countPendientesHasta(anyInt())).thenReturn(2L);
        Health h = indicator("re_live_key", "envios@animeshowdown.dev").health();
        assertThat(h.getStatus()).isEqualTo(Status.UP);
        assertThat(h.getDetails().get("fallos_pendientes")).isEqualTo(2L);
    }

    @Test
    void colaDeFallosSaturadaDevuelveDegraded() {
        // El conteo acotado satura en el umbral (10): igualar el umbral = DEGRADED.
        when(emailFailureRepository.countPendientesHasta(anyInt())).thenReturn(10L);
        Health h = indicator("re_live_key", "envios@animeshowdown.dev").health();
        assertThat(h.getStatus()).isEqualTo(new Status("DEGRADED"));
        assertThat(h.getDetails().get("fallos_pendientes").toString()).contains("10");
    }

    @Test
    void siLaColaNoSeConsultaSigueUpSinReventar() {
        lenient().when(emailFailureRepository.countPendientesHasta(anyInt()))
                .thenThrow(new RuntimeException("db down"));
        Health h = indicator("re_live_key", "envios@animeshowdown.dev").health();
        assertThat(h.getStatus()).isEqualTo(Status.UP);
        assertThat(h.getDetails().get("cola_fallos").toString()).contains("no consultable");
    }
}
