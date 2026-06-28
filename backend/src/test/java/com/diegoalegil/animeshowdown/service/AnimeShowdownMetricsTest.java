package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.diegoalegil.animeshowdown.model.EmailTipo;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

/**
 * Verifica que los contadores del embudo de adquisición se registran y se
 * incrementan con sus tags. Antes había métricas de engagement pero CERO del
 * funnel registro→verificación→voto; este test blinda esa instrumentación.
 */
class AnimeShowdownMetricsTest {

    private SimpleMeterRegistry registry;
    private AnimeShowdownMetrics metrics;

    @BeforeEach
    void setUp() {
        registry = new SimpleMeterRegistry();
        metrics = new AnimeShowdownMetrics(registry);
    }

    private double contador(String nombre, String... tags) {
        Counter c = registry.find(nombre).tags(tags).counter();
        return c == null ? -1 : c.count();
    }

    @Test
    void registroCompletadoIncrementaElContador() {
        metrics.registroCompletado();
        metrics.registroCompletado();
        assertThat(contador("as.funnel.registro.completado")).isEqualTo(2.0);
    }

    @Test
    void emailVerificacionEmitidaYConfirmadaSonContadoresDistintos() {
        metrics.emailVerificacionEmitida();
        metrics.emailVerificacionConfirmada();
        metrics.emailVerificacionConfirmada();
        assertThat(contador("as.funnel.email.verificacion.emitida")).isEqualTo(1.0);
        assertThat(contador("as.funnel.email.verificacion.confirmada")).isEqualTo(2.0);
    }

    @Test
    void clientEventRechazadoSeAgregaEnUnaSerieDeTagFijo() {
        metrics.clientEvent("landing_view");
        metrics.clientEventRechazado();
        metrics.clientEventRechazado();
        // El conocido va por su nombre; los desconocidos NO crean serie por nombre,
        // se acumulan en el tag fijo 'otro_no_reconocido' (cardinalidad acotada).
        assertThat(contador("as.funnel.client", "evento", "landing_view")).isEqualTo(1.0);
        assertThat(contador("as.funnel.client", "evento", "otro_no_reconocido")).isEqualTo(2.0);
    }

    @Test
    void emailEnviadoYFalloSeSegmentanPorTipo() {
        metrics.emailEnviado(EmailTipo.VERIFICACION);
        metrics.emailFallo(EmailTipo.VERIFICACION);
        metrics.emailFallo(EmailTipo.RESET_PASSWORD);
        assertThat(contador("as.funnel.email.enviado", "tipo", "VERIFICACION")).isEqualTo(1.0);
        assertThat(contador("as.funnel.email.fallo", "tipo", "VERIFICACION")).isEqualTo(1.0);
        assertThat(contador("as.funnel.email.fallo", "tipo", "RESET_PASSWORD")).isEqualTo(1.0);
    }

    @Test
    void emailTipoNuloSeEtiquetaComoDesconocidoSinReventar() {
        metrics.emailFallo(null);
        assertThat(contador("as.funnel.email.fallo", "tipo", "desconocido")).isEqualTo(1.0);
    }

    @Test
    void votoFunnelSeSegmentaPorTipoDeVotante() {
        metrics.votoFunnel("anonimo");
        metrics.votoFunnel("registrado");
        metrics.votoFunnel("registrado");
        metrics.votoFunnel("empate");
        assertThat(contador("as.funnel.voto", "tipo", "anonimo")).isEqualTo(1.0);
        assertThat(contador("as.funnel.voto", "tipo", "registrado")).isEqualTo(2.0);
        assertThat(contador("as.funnel.voto", "tipo", "empate")).isEqualTo(1.0);
    }
}
